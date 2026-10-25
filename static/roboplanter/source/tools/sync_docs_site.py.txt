"""Copy public RoboPlanter documentation into the explicitly selected Docusaurus checkout.

No git, deployment, credential loading, or network operations are performed.
Only the managed project directory, static/roboplanter, and a bounded projects
index block are changed. Original vendor attachments and private settings are
never copied. Run from any directory with Python 3.10+.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import zipfile
from package_public_starter import package as package_starter, source_files, write_member

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_BASE = "/docs/projects/2026/roboplanter"
PAGES = [
    ("index", "工位搭子 · RoboPlanter", "从工位绿植开始，了解产品、硬件、YOYO Skill 与开放设备接入。"),
    ("product-story", "产品故事与设计思考", "用户假设、利他原则、产品任务、体验旅程与比赛叙事。"),
    ("hardware-quickstart", "硬件从零到首次读取", "XIAO 与 Indicator 的认板、供电、备份、接线、构建和分阶段联调。"),
    ("plant-companion", "植物生长与陪伴养成", "真实物候、预测与陪伴反馈分开，逐步替换加速演示周期。"),
    ("crop-knowledge", "作物知识库与地区化方案", "官方农业资源、学术依据、开源工具及带适用条件的离线原型。"),
    ("ws2812-lighting", "WS2812 灯带与氛围交互", "灯带接线、四种模式、HTTP/BLE/CLI 控制与分阶段实机验收。"),
    ("honor-platform", "荣耀 YOYO 平台操作", "从已经上传的独立 Skill 草稿继续，核对配置、检测、手机测试与发布边界。"),
    ("ble-integration", "BLE 完整接入教程", "官方工具参数、设备协议、MTU、凭证注入、回包语义和逐步验收。"),
    ("device-platform", "自带硬件与 Device Kit", "统一能力描述、离线登记和验证，以及未来在线平台的边界。"),
    ("design-system", "产品视觉与交互设计", "工位搭子的视觉语言、角色、状态、动效和可访问性规则。"),
    ("social-playbook", "社媒创作与路演", "小红书图文、竖屏视频、原创文案、拍摄方法和真实效果评测。"),
    ("roadmap-evidence", "证据与扩展路线图", "区分已实现、未验收与未来设计，逐步走向设施农业与灌溉。"),
    ("acceptance", "分阶段验收与记录", "从离线测试到真实设备控制的检查项、失败场景和记录模板。"),
    ("troubleshooting", "排障与恢复", "从电源、串口、构建、显示、HTTP 到 BLE 的故障诊断。"),
]


def public_markdown(text: str, source: Path, source_ref: str) -> str:
    """Keep handbook links local and make other repository references explicit."""
    public_paths = {p.relative_to(ROOT) for p in source_files()}
    def replace(match: re.Match[str]) -> str:
        label, target = match.group(1), match.group(2)
        if re.match(r"^(https?://|mailto:|#|/)", target):
            return match.group(0)
        path_text, _, fragment = target.partition("#")
        resolved = (source.parent / path_text).resolve()
        try:
            relative = resolved.relative_to(ROOT)
        except ValueError:
            raise ValueError(f"Out-of-project link in {source.name}: {target}")
        if relative.parts[:2] == ("docs", "handbook"):
            destination = PUBLIC_BASE + ("/" if resolved.stem == "index" else "/" + resolved.stem)
            if fragment:
                destination += "#" + fragment
        elif relative.parts[:2] == ("web", "experience"):
            destination = "/roboplanter/" + Path(*relative.parts[2:]).as_posix()
        elif relative in public_paths:
            destination = "/roboplanter/source/" + relative.as_posix() + ".txt"
        elif relative.parts[:2] == ("docs", "deployment") or relative.parts[0] == "reference":
            if source.stem == "roadmap-evidence":
                return label + "（原始记录未公开；本页为摘要）"
            destination = PUBLIC_BASE + "/roadmap-evidence"
        else:
            kind = "tree" if resolved.is_dir() else "blob"
            destination = f"https://github.com/peterpanstechland/RoboPlanter/{kind}/{source_ref}/{relative.as_posix()}"
            if fragment:
                destination += "#" + fragment
        return f"[{label}]({destination})"
    return re.sub(r"\[([^\]]+)\]\(([^\s)]+)\)", replace, text)


def build_device_kit_bundle(destination: Path) -> dict:
    files = [p for p in source_files() if p.relative_to(ROOT).as_posix().startswith("integrations/device-kit/") or p.relative_to(ROOT).as_posix() in {"tests/test_device_kit.py", "docs/handbook/device-platform.md"}]
    index = {}
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as bundle:
        for path in files:
            name = path.relative_to(ROOT).as_posix()
            data = path.read_bytes()
            write_member(bundle, name, data)
            index[name] = hashlib.sha256(data).hexdigest()
        write_member(bundle, "README-START-HERE.txt", b"RoboPlanter Device Kit\nPython 3.10+, standard library only.\nRun: python3 integrations/device-kit/device_kit.py validate integrations/device-kit/profiles/*.json\nRun tests: python3 -m unittest discover -s tests -p test_device_kit.py -v\nThis is an offline toolkit. No device connection, credential loading, or commands are supported.\nDocs: https://peterpanstechland.github.io/docs/projects/2026/roboplanter/device-platform\n")
        write_member(bundle, "SOURCE-MANIFEST.json", (json.dumps(index, indent=2, ensure_ascii=False) + "\n").encode())
    return {"filename": destination.name, "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(), "files": len(files)}


def sync(site: Path, source_ref: str) -> dict:
    site = site.resolve()
    if not (site / "docusaurus.config.ts").is_file() or not (site / "package.json").is_file():
        raise ValueError("--site must be an existing Docusaurus checkout")
    if site == ROOT:
        raise ValueError("The docs site must be a separate checkout")
    out = site / "docs/projects/2026/roboplanter"
    out.mkdir(parents=True, exist_ok=True)
    for position, (slug, title, description) in enumerate(PAGES, 1):
        source = ROOT / "docs/handbook" / f"{slug}.md"
        content = public_markdown(source.read_text(encoding="utf-8"), source, source_ref)
        front = f"---\ntitle: {json.dumps(title, ensure_ascii=False)}\ndescription: {json.dumps(description, ensure_ascii=False)}\nsidebar_position: {position}\nhide_title: true\n"
        if slug == "index":
            front += "slug: /projects/2026/roboplanter\n"
        front += "---\n\n"
        if slug == "index":
            content = content.replace("## 按你的目标开始", "![工位搭子概念角色与原创工位海报，非实机拍摄](/roboplanter/assets/social-cover.png)\n\n## 按你的目标开始", 1)
        (out / f"{slug}.md").write_text(front + content, encoding="utf-8")
    (out / "_category_.json").write_text(json.dumps({"label": "工位搭子 · RoboPlanter", "position": 1, "link": {"type": "doc", "id": "index"}}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # Same Chinese handbook remains available through the site's Chinese locale.
    zh = site / "i18n/zh-Hans/docusaurus-plugin-content-docs/current/projects/2026/roboplanter"
    zh.mkdir(parents=True, exist_ok=True)
    for page in out.iterdir():
        shutil.copy2(page, zh / page.name)
    static = site / "static/roboplanter"
    marker = static / ".roboplanter-managed"
    if static.exists():
        if static.is_symlink() or not marker.is_file():
            raise ValueError("Refusing to replace an unowned static/roboplanter directory")
        shutil.rmtree(static)
    shutil.copytree(ROOT / "web/experience", static, dirs_exist_ok=True, ignore=shutil.ignore_patterns("README.md"))
    marker.write_text("managed by tools/sync_docs_site.py\n", encoding="utf-8")
    downloads = static / "downloads"
    downloads.mkdir(exist_ok=True)
    kit = build_device_kit_bundle(downloads / "roboplanter-device-kit.zip")
    starter = package_starter(downloads / "roboplanter-starter.zip")
    for path in source_files():
        copy = static / "source" / (path.relative_to(ROOT).as_posix() + ".txt")
        copy.parent.mkdir(parents=True, exist_ok=True)
        copy.write_bytes(path.read_bytes())
    (downloads / "manifest.json").write_text(json.dumps({"device_kit": kit, "starter": starter}, indent=2) + "\n", encoding="utf-8")
    block = "\n<!-- ROBOPLANTER:START -->\n### [工位搭子 · RoboPlanter](/docs/projects/2026/roboplanter/)\n\n你先下班，我负责发芽。YOYO Skill、XIAO 设备控制、Indicator 像素养成，以及可供自带硬件使用的离线 Device Kit。\n\n[互动体验与原创工位海报](https://peterpanstechland.github.io/roboplanter/) · [硬件与荣耀平台教程](/docs/projects/2026/roboplanter/hardware-quickstart) · [设备接入方案](/docs/projects/2026/roboplanter/device-platform)\n\n**进度：** 屏幕端已有实物记录；手机 BLE / 传感器执行器闭环仍待验收。展示交互是模拟，设施农业与在线多设备平台为未来方向。\n<!-- ROBOPLANTER:END -->\n"
    indexes = [site / "docs/projects/index.md", site / "i18n/zh-Hans/docusaurus-plugin-content-docs/current/projects/index.md"]
    for path in indexes:
        original = path.read_text(encoding="utf-8")
        if "<!-- ROBOPLANTER:START -->" in original:
            updated = re.sub(r"\n?<!-- ROBOPLANTER:START -->.*?<!-- ROBOPLANTER:END -->\n?", block, original, flags=re.S)
        else:
            # Keep all existing portfolio content and insert just after front matter.
            boundary = original.find("\n---", 4) if original.startswith("---") else -1
            boundary = original.find("\n", boundary + 1) + 1 if boundary >= 0 else 0
            updated = original[:boundary] + block + original[boundary:]
        path.write_text(updated, encoding="utf-8")
    return {"site": str(site), "pages_per_locale": len(PAGES), "locales": ["en", "zh-Hans"], "device_kit": kit, "starter": starter}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site", type=Path, required=True)
    parser.add_argument("--source-ref", default="codex/initial-sync")
    args = parser.parse_args()
    print(json.dumps(sync(args.site, args.source_ref), ensure_ascii=False, indent=2))
