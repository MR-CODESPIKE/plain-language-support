#!/usr/bin/env python3
"""Builds the .vsix package without vsce or npm (a VSIX is a zip file with an XML manifest).

Usage: python3 tools/build_vsix.py [output-directory]

The file list follows .vscodeignore, the same rules `vsce package` uses. `npm run package` (vsce)
produces an equivalent file; this script exists so the extension can be packaged anywhere.
"""
import fnmatch
import json
import pathlib
import sys
import zipfile
from xml.sax.saxutils import escape

ROOT = pathlib.Path(__file__).resolve().parent.parent


def ignore_patterns():
    path = ROOT / ".vscodeignore"
    lines = path.read_text(encoding="utf-8").splitlines() if path.exists() else []
    return [line.strip() for line in lines if line.strip() and not line.strip().startswith("#")]


def is_ignored(relative, patterns):
    name = pathlib.PurePosixPath(relative).name
    for pattern in patterns:
        pattern = pattern.rstrip("/")
        if pattern.endswith("/**"):
            base = pattern[:-3]
            if relative == base or relative.startswith(base + "/"):
                return True
        elif fnmatch.fnmatch(relative, pattern) or fnmatch.fnmatch(name, pattern):
            return True
    return False


def collect_files():
    patterns = ignore_patterns()
    files = []
    for path in sorted(ROOT.rglob("*")):
        if not path.is_file():
            continue
        relative = path.relative_to(ROOT).as_posix()
        if relative.startswith(".git/") or is_ignored(relative, patterns):
            continue
        files.append(relative)
    return files


def archive_name(relative):
    """vsce stores README.md and CHANGELOG.md in lower case."""
    lowered = {"README.md": "readme.md", "CHANGELOG.md": "changelog.md"}
    return "extension/" + lowered.get(relative, relative)


def manifest_xml(package, files):
    repo = package.get("repository", {}).get("url", "")
    repo_http = repo[:-4] if repo.endswith(".git") else repo
    bugs = package.get("bugs", {}).get("url", repo_http + "/issues" if repo_http else "")
    extensions = [e.lstrip(".") for lang in package.get("contributes", {}).get("languages", []) for e in lang.get("extensions", [])]
    tags = list(package.get("keywords", [])) + ["__ext_" + e for e in extensions]
    if "browser" in package:
        tags.append("__web_extension")
    kind = "workspace" if "main" in package and "browser" not in package else "ui,workspace,web"
    assets = [
        ("Microsoft.VisualStudio.Code.Manifest", "extension/package.json"),
        ("Microsoft.VisualStudio.Services.Content.Details", "extension/readme.md"),
        ("Microsoft.VisualStudio.Services.Content.Changelog", "extension/changelog.md"),
        ("Microsoft.VisualStudio.Services.Content.License", "extension/LICENSE.txt"),
    ]
    present = {archive_name(f) for f in files}
    assets = [(kind_, path) for kind_, path in assets if path in present]
    props = [
        ("Microsoft.VisualStudio.Code.Engine", package["engines"]["vscode"]),
        ("Microsoft.VisualStudio.Code.ExtensionDependencies", ""),
        ("Microsoft.VisualStudio.Code.ExtensionPack", ""),
        ("Microsoft.VisualStudio.Code.ExtensionKind", kind),
        ("Microsoft.VisualStudio.Code.LocalizedLanguages", ""),
        ("Microsoft.VisualStudio.Code.EnabledApiProposals", ""),
    ]
    if repo:
        props += [
            ("Microsoft.VisualStudio.Services.Links.Source", repo),
            ("Microsoft.VisualStudio.Services.Links.Getstarted", repo),
            ("Microsoft.VisualStudio.Services.Links.GitHub", repo),
            ("Microsoft.VisualStudio.Services.Links.Support", bugs),
            ("Microsoft.VisualStudio.Services.Links.Learn", repo_http + "#readme"),
        ]
    props += [
        ("Microsoft.VisualStudio.Services.GitHubFlavoredMarkdown", "true"),
        ("Microsoft.VisualStudio.Services.Content.Pricing", "Free"),
    ]
    lines = [
        '<?xml version="1.0" encoding="utf-8"?>',
        '\t<PackageManifest Version="2.0.0" xmlns="http://schemas.microsoft.com/developer/vsx-schema/2011" xmlns:d="http://schemas.microsoft.com/developer/vsx-schema-design/2011">',
        "\t\t<Metadata>",
        f'\t\t\t<Identity Language="en-US" Id="{escape(package["name"])}" Version="{escape(package["version"])}" Publisher="{escape(package["publisher"])}" />',
        f'\t\t\t<DisplayName>{escape(package["displayName"])}</DisplayName>',
        f'\t\t\t<Description xml:space="preserve">{escape(package["description"])}</Description>',
        f"\t\t\t<Tags>{escape(','.join(tags))}</Tags>",
        f"\t\t\t<Categories>{escape(','.join(package.get('categories', [])))}</Categories>",
        "\t\t\t<GalleryFlags>Public</GalleryFlags>",
        "\t\t\t<Properties>",
    ]
    lines += [f'\t\t\t\t<Property Id="{pid}" Value="{escape(value)}" />' for pid, value in props]
    lines += [
        "\t\t\t</Properties>",
        "\t\t\t<License>extension/LICENSE.txt</License>",
        "\t\t</Metadata>",
        "\t\t<Installation>",
        '\t\t\t<InstallationTarget Id="Microsoft.VisualStudio.Code"/>',
        "\t\t</Installation>",
        "\t\t<Dependencies/>",
        "\t\t<Assets>",
    ]
    lines += [f'\t\t\t<Asset Type="{kind_}" Path="{path}" Addressable="true" />' for kind_, path in assets]
    lines += ["\t\t</Assets>", "\t</PackageManifest>", ""]
    return "\n".join(lines)


CONTENT_TYPES = (
    '<?xml version="1.0" encoding="utf-8"?>\n'
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    '<Default Extension=".js" ContentType="application/javascript"/>'
    '<Default Extension=".json" ContentType="application/json"/>'
    '<Default Extension=".md" ContentType="text/markdown"/>'
    '<Default Extension=".txt" ContentType="text/plain"/>'
    '<Default Extension=".vsixmanifest" ContentType="text/xml"/>'
    "</Types>\n"
)


def main():
    package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
    out_dir = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT
    out_dir.mkdir(parents=True, exist_ok=True)
    target = out_dir / f"{package['name']}-{package['version']}.vsix"
    files = collect_files()
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("extension.vsixmanifest", manifest_xml(package, files))
        archive.writestr("[Content_Types].xml", CONTENT_TYPES)
        for relative in files:
            archive.write(ROOT / relative, archive_name(relative))
    print(f"wrote {target} ({len(files)} files)")


if __name__ == "__main__":
    main()
