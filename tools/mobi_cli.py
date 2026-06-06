#!/usr/bin/env python3
"""Styled terminal UI for the mobi launcher."""

from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image
from rich.console import Console, Group
from rich.padding import Padding
from rich.text import Text

ACCENT = "#97c6ff"
MUTED = "bright_black"
STATUS_STYLE = "white"
ROBOT_PX_WIDTH = 26
ROBOT_RENDER_DENSITY = 400
ROBOT_GAP = 2
BRAND_BLUE = (0x97, 0xC6, 0xFF)
BRAND_DARK = (0x35, 0x35, 0x35)
BLUE_STYLE = "#97c6ff"
DARK_STYLE = "bold black"
APP_DIR = Path(__file__).resolve().parent.parent
ROBOT_SVG = APP_DIR / "assets" / "robot-cli.svg"


def _svg_to_png(svg_path: Path, width: int) -> Path:
    tmp = tempfile.NamedTemporaryFile(suffix=".png", delete=False)
    tmp.close()
    out = Path(tmp.name)
    resize = f"{width}x"
    base = [
        "-background",
        "none",
        "-density",
        str(ROBOT_RENDER_DENSITY),
        str(svg_path),
        "-filter",
        "point",
        "-resize",
        resize,
        str(out),
    ]
    for cmd in (["magick", *base], ["convert", *base]):
        try:
            subprocess.run(cmd, check=True, capture_output=True)
            return out
        except (FileNotFoundError, subprocess.CalledProcessError):
            continue
    raise RuntimeError("ImageMagick is required to render the mobi robot (magick or convert).")


def _quantize_brand_colors(img: Image.Image) -> Image.Image:
    """Snap rasterized pixels to exact brand colors for crisp eyes and edges."""
    source = img.convert("RGBA")
    out = Image.new("RGBA", source.size)
    for x in range(source.width):
        for y in range(source.height):
            red, green, blue, alpha = source.getpixel((x, y))
            if alpha < 128:
                out.putpixel((x, y), (0, 0, 0, 0))
            elif red + green + blue < 380:
                out.putpixel((x, y), (*BRAND_DARK, 255))
            else:
                out.putpixel((x, y), (*BRAND_BLUE, 255))

    # Slightly thicken eye pixels so they survive terminal downsampling.
    thickened = out.copy()
    for x in range(out.width):
        for y in range(out.height):
            if out.getpixel((x, y))[:3] == BRAND_DARK and y + 1 < out.height:
                thickened.putpixel((x, y + 1), (*BRAND_DARK, 255))
    return thickened


def _pixel_color(red: int, green: int, blue: int, alpha: int) -> tuple[int, int, int] | None:
    if alpha < 128:
        return None
    if (red, green, blue) == BRAND_DARK:
        return BRAND_DARK
    return BRAND_BLUE


def _crop_robot(img: Image.Image) -> Image.Image:
    bbox = img.getbbox()
    return img.crop(bbox) if bbox else img


def _image_to_text(img: Image.Image) -> Text:
    """Half-height cells using solid blocks only (no blurry half-block glyphs)."""
    pixels = _crop_robot(_quantize_brand_colors(img))
    width, height = pixels.size
    lines: list[Text] = []

    for y in range(0, height, 2):
        row = Text()
        for x in range(width):
            r1, g1, b1, a1 = pixels.getpixel((x, y))
            if y + 1 < height:
                r2, g2, b2, a2 = pixels.getpixel((x, y + 1))
            else:
                r2, g2, b2, a2 = 0, 0, 0, 0

            top = _pixel_color(r1, g1, b1, a1)
            bottom = _pixel_color(r2, g2, b2, a2)
            if top is None and bottom is None:
                row.append(" ")
            elif top == BRAND_DARK or bottom == BRAND_DARK:
                row.append("█", style=DARK_STYLE)
            else:
                row.append("█", style=BLUE_STYLE)
        lines.append(row)

    trimmed = _trim_empty_rows(lines)
    return Text("\n").join(trimmed)


def _trim_empty_rows(rows: list[Text]) -> list[Text]:
    def is_blank(row: Text) -> bool:
        return not row.plain.strip()

    start = 0
    end = len(rows)
    while start < end and is_blank(rows[start]):
        start += 1
    while end > start and is_blank(rows[end - 1]):
        end -= 1
    return rows[start:end] if start < end else rows


def render_robot() -> Text:
    png_path = _svg_to_png(ROBOT_SVG, ROBOT_PX_WIDTH)
    try:
        with Image.open(png_path) as img:
            return _image_to_text(img)
    finally:
        png_path.unlink(missing_ok=True)


def _robot_column_width(robot: Text, console: Console) -> int:
    width = 0
    for segment in robot.split("\n", include_separator=False):
        width = max(width, segment.cell_len)
    return max(width, ROBOT_PX_WIDTH // 2) + ROBOT_GAP


def _side_by_side(console: Console, robot: Text, status_lines: list[str]) -> Group:
    robot_rows = list(robot.split("\n", include_separator=False))
    col_width = _robot_column_width(robot, console)
    pad = " " * col_width
    rows: list[Text] = []
    total = max(len(robot_rows), len(status_lines))

    if len(status_lines) < len(robot_rows):
        offset = (len(robot_rows) - len(status_lines)) // 2
        status_lines = [""] * offset + status_lines + [""] * (
            len(robot_rows) - len(status_lines) - offset
        )
    elif len(status_lines) > len(robot_rows):
        offset = (len(status_lines) - len(robot_rows)) // 2
        robot_rows = [Text("")] * offset + robot_rows + [Text("")] * (
            len(status_lines) - len(robot_rows) - offset
        )

    total = max(len(robot_rows), len(status_lines))

    for index in range(total):
        row = Text()
        if index < len(robot_rows):
            row.append_text(robot_rows[index])
            if row.cell_len < col_width:
                row.append(" " * (col_width - row.cell_len))
        else:
            row.append(pad)
        if index < len(status_lines):
            row.append(status_lines[index], style=STATUS_STYLE)
        rows.append(row)

    return Group(*rows)


def _hline(console: Console) -> Text:
    width = max(console.size.width, 40)
    return Text("─" * width, style=ACCENT)


def _input_row() -> Text:
    row = Text()
    row.append("> ", style=ACCENT)
    row.append('Type anything, to mention agents use "@"', style=MUTED)
    return row


def _footer_row(console: Console) -> Text:
    label = Text('Keyboard shortcuts "?"', style=MUTED)
    width = max(console.size.width, 40)
    padding = max(width - len('Keyboard shortcuts "?"'), 0)
    row = Text(" " * padding, style=MUTED)
    row.append_text(label)
    return row


def render_ui(status_lines: list[str]) -> None:
    console = Console(highlight=False, soft_wrap=True)
    robot = render_robot()

    console.print()
    console.print(_side_by_side(console, robot, status_lines))
    console.print()
    console.print(_hline(console))
    console.print(Padding(_input_row(), (0, 0, 0, 1)))
    console.print(_hline(console))
    console.print(Padding(_footer_row(console), (0, 1, 0, 0)))
    console.print()


def main() -> int:
    lines = [line for line in sys.argv[1:] if line]
    if not lines:
        lines = ["Mobi is ready."]
    try:
        render_ui(lines)
    except Exception as exc:  # noqa: BLE001 - show fallback for missing deps
        console = Console()
        for line in lines:
            console.print(line)
        console.print(f"[{MUTED}]UI render skipped: {exc}[/]")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
