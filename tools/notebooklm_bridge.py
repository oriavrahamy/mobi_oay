#!/usr/bin/env python3
"""Local bridge from the browser app to notebooklm-py CLI.

Install the CLI first:
  pip install "notebooklm-py[browser]"
  playwright install chromium
  notebooklm login

Run this bridge from the project root:
  python3 tools/notebooklm_bridge.py

Then connect the NotebookLM tool in the app with:
  Local Bridge URL: http://localhost:8787/notebooklm
  CLI Command: notebooklm
"""
from __future__ import annotations

import json
import subprocess
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

HOST = "127.0.0.1"
PORT = 8787
MAX_BODY_BYTES = 256_000
DOWNLOAD_DIR = Path.home() / "Downloads" / "mobi-notebooklm"


def _run_cli(command: str, args: list[str], prompt_text: str | None = None, stdin_text: str | None = None) -> dict[str, Any]:
    executable = command.strip() or "notebooklm"
    if any(ch in executable for ch in " ;|&$`<>\n\r"):
        raise ValueError("CLI command must be a single executable name or path")

    prompt_file = None
    try:
        if prompt_text:
            handle = tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, suffix=".txt")
            prompt_file = Path(handle.name)
            with handle:
                handle.write(prompt_text)
            args = [*args, "--prompt-file", str(prompt_file)]

        proc = subprocess.run(
            [executable, *args],
            input=stdin_text,
            text=True,
            capture_output=True,
            timeout=180,
            check=False,
        )
        return {
            "ok": proc.returncode == 0,
            "returncode": proc.returncode,
            "stdout": proc.stdout,
            "stderr": proc.stderr,
            "command": [executable, *args],
        }
    finally:
        if prompt_file:
            prompt_file.unlink(missing_ok=True)


def _notebook_args(params: dict[str, Any]) -> list[str]:
    notebook_id = params.get("notebookId") or params.get("notebook_id") or params.get("notebook")
    return ["-n", str(notebook_id)] if notebook_id else []


def _json_flag(params: dict[str, Any]) -> list[str]:
    return [] if params.get("json") is False else ["--json"]


def _required_param(params: dict[str, Any], *names: str) -> str:
    for name in names:
        value = params.get(name)
        if value not in (None, ""):
            return str(value)
    raise ValueError(f"Missing required parameter: {' or '.join(names)}")


def _bool_flag(args: list[str], flag: str, enabled: Any) -> None:
    if enabled:
        args.append(flag)


def _append_if_present(args: list[str], flag: str, params: dict[str, Any], *names: str) -> None:
    for name in names:
        value = params.get(name)
        if value not in (None, ""):
            args.extend([flag, str(value)])
            return


def _artifact_output_path(kind: str, params: dict[str, Any]) -> str | None:
    output_path = params.get("outputPath") or params.get("path")
    if output_path:
        return str(output_path)
    if params.get("dryRun") or params.get("dry_run") or params.get("all"):
        return None

    extension = {
        "audio": "mp3",
        "video": "mp4",
        "cinematic-video": "mp4",
        "slide-deck": params.get("format") or "pdf",
        "infographic": "png",
        "report": "md",
        "mind-map": "json",
        "data-table": "csv",
        "quiz": params.get("format") or "json",
        "flashcards": params.get("format") or "json",
    }.get(kind, "out")
    DOWNLOAD_DIR.mkdir(parents=True, exist_ok=True)
    return str(DOWNLOAD_DIR / f"{kind}-{int(time.time())}.{extension}")


def _generate_args(kind: str, params: dict[str, Any]) -> tuple[list[str], str | None]:
    args = ["generate", kind, *_notebook_args(params), *_json_flag(params)]
    prompt = params.get("description") or params.get("prompt") or params.get("question") or ""

    if kind != "mind-map" and params.get("wait"):
        args.append("--wait")
    if kind != "mind-map":
        _append_if_present(args, "--timeout", params, "timeout")
        _append_if_present(args, "--interval", params, "interval")
        _append_if_present(args, "--retry", params, "retry")
    if kind not in {"quiz", "flashcards", "revise-slide"}:
        _append_if_present(args, "--language", params, "language")

    if kind == "audio":
        _append_if_present(args, "--format", params, "format")
        _append_if_present(args, "--length", params, "length")
    elif kind in {"video", "cinematic-video"}:
        _append_if_present(args, "--format", params, "format")
        _append_if_present(args, "--style", params, "style")
        _append_if_present(args, "--style-prompt", params, "stylePrompt", "style_prompt")
    elif kind == "slide-deck":
        _append_if_present(args, "--format", params, "format")
        _append_if_present(args, "--length", params, "length")
    elif kind in {"quiz", "flashcards"}:
        _append_if_present(args, "--difficulty", params, "difficulty")
        _append_if_present(args, "--quantity", params, "quantity")
    elif kind == "infographic":
        _append_if_present(args, "--orientation", params, "orientation")
        _append_if_present(args, "--detail", params, "detail")
        _append_if_present(args, "--style", params, "style")
    elif kind == "report":
        _append_if_present(args, "--format", params, "format")
        _append_if_present(args, "--append", params, "append")
    elif kind == "mind-map":
        if prompt:
            args.extend(["--instructions", prompt])
            prompt = ""

    for source_id in params.get("sources") or []:
        args.extend(["-s", str(source_id)])

    return args, prompt or None


def handle_notebooklm(payload: dict[str, Any]) -> dict[str, Any]:
    action = payload.get("action") or "ask"
    params = payload.get("params") or {}
    command = params.get("cliCommand") or payload.get("cliCommand") or "notebooklm"

    if action in {"list", "list_notebooks", "notebooks"}:
        args = ["list", *_json_flag(params)]
        _append_if_present(args, "--limit", params, "limit")
        _bool_flag(args, "--no-truncate", params.get("noTruncate") or params.get("no_truncate"))
        return _run_cli(command, args)

    if action in {"status", "notebook_status"}:
        args = ["status", *_json_flag(params)]
        _bool_flag(args, "--paths", params.get("paths"))
        return _run_cli(command, args)

    if action in {"create", "create_notebook", "notebook_create"}:
        title = _required_param(params, "title", "name")
        args = ["create", title, *_json_flag(params)]
        _bool_flag(args, "--use", params.get("use"))
        return _run_cli(command, args)

    if action in {"rename", "rename_notebook", "notebook_rename"}:
        title = _required_param(params, "title", "name")
        return _run_cli(command, ["rename", title, *_notebook_args(params), *_json_flag(params)])

    if action in {"delete", "delete_notebook", "notebook_delete"}:
        return _run_cli(command, ["delete", *_notebook_args(params), "-y", *_json_flag(params)])

    if action == "use":
        notebook_id = params.get("notebookId") or params.get("notebook_id") or params.get("notebook")
        if not notebook_id:
            raise ValueError("NotebookLM use requires params.notebookId")
        return _run_cli(command, ["use", str(notebook_id), *_json_flag(params)])

    if action == "ask":
        question = params.get("question") or params.get("prompt") or ""
        if not question:
            raise ValueError("NotebookLM ask requires params.question")
        args = ["ask", *_notebook_args(params), *_json_flag(params)]
        _append_if_present(args, "-c", params, "conversationId", "conversation_id")
        _append_if_present(args, "--request-timeout", params, "requestTimeout", "request_timeout")
        if params.get("new"):
            args.extend(["--new", "--yes"])
        _bool_flag(args, "--save-as-note", params.get("saveAsNote") or params.get("save_as_note"))
        _append_if_present(args, "--note-title", params, "noteTitle", "note_title")
        for source_id in params.get("sources") or []:
            args.extend(["-s", str(source_id)])
        return _run_cli(command, args, prompt_text=question)

    if action == "summary":
        args = ["summary", *_notebook_args(params), *_json_flag(params)]
        _bool_flag(args, "--topics", params.get("topics"))
        return _run_cli(command, args)

    if action in {"configure_chat", "chat_configure"}:
        args = ["configure", *_notebook_args(params), *_json_flag(params)]
        _append_if_present(args, "--mode", params, "mode")
        _append_if_present(args, "--persona", params, "persona")
        _append_if_present(args, "--response-length", params, "responseLength", "response_length")
        return _run_cli(command, args)

    if action in {"history", "chat_history"}:
        args = ["history", *_notebook_args(params), *_json_flag(params)]
        _append_if_present(args, "-l", params, "limit")
        _bool_flag(args, "--clear", params.get("clear"))
        _bool_flag(args, "--save", params.get("save"))
        _append_if_present(args, "-t", params, "title")
        _bool_flag(args, "--show-all", params.get("showAll") or params.get("show_all"))
        _bool_flag(args, "--no-truncate", params.get("noTruncate") or params.get("no_truncate"))
        return _run_cli(command, args)

    if action in {"source_list", "sources"}:
        args = ["source", "list", *_notebook_args(params), *_json_flag(params)]
        _append_if_present(args, "--limit", params, "limit")
        _bool_flag(args, "--no-truncate", params.get("noTruncate") or params.get("no_truncate"))
        return _run_cli(command, args)

    if action in {"source_add", "add_source"}:
        content = _required_param(params, "content", "url", "path", "text")
        args = ["source", "add", content, *_notebook_args(params), *_json_flag(params)]
        _append_if_present(args, "--title", params, "title")
        _append_if_present(args, "--type", params, "type")
        _append_if_present(args, "--mime-type", params, "mimeType", "mime_type")
        _append_if_present(args, "--timeout", params, "timeout")
        _bool_flag(args, "--follow-symlinks", params.get("followSymlinks") or params.get("follow_symlinks"))
        return _run_cli(command, args)

    if action in {"source_add_text", "add_text_source"}:
        text = _required_param(params, "text", "content")
        args = ["source", "add", "-", *_notebook_args(params), "--type", "text", *_json_flag(params)]
        _append_if_present(args, "--title", params, "title")
        return _run_cli(command, args, stdin_text=text)

    if action in {"source_add_drive", "add_drive_source"}:
        file_id = _required_param(params, "fileId", "file_id", "id")
        title = _required_param(params, "title", "name")
        args = ["source", "add-drive", *_notebook_args(params), file_id, title, *_json_flag(params)]
        _append_if_present(args, "--mime-type", params, "mimeType", "mime_type")
        return _run_cli(command, args)

    if action in {"source_get", "source_guide", "source_fulltext", "source_stale", "source_wait", "source_refresh", "source_delete"}:
        source_id = _required_param(params, "sourceId", "source_id", "id")
        subcommand = action.replace("source_", "").replace("_", "-")
        args = ["source", subcommand, source_id, *_notebook_args(params), *_json_flag(params)]
        if subcommand == "delete":
            args.append("-y")
        if subcommand == "fulltext":
            _append_if_present(args, "-f", params, "format")
            _append_if_present(args, "-o", params, "outputPath", "path")
            _bool_flag(args, "--force", params.get("force"))
            _bool_flag(args, "--no-clobber", params.get("noClobber") or params.get("no_clobber"))
        if subcommand == "wait":
            _append_if_present(args, "--timeout", params, "timeout")
            _append_if_present(args, "--interval", params, "interval")
        if subcommand == "stale":
            _bool_flag(args, "--exit-on-stale", params.get("exitOnStale") or params.get("exit_on_stale"))
        return _run_cli(command, args)

    if action in {"source_rename", "rename_source"}:
        source_id = _required_param(params, "sourceId", "source_id", "id")
        title = _required_param(params, "title", "name")
        return _run_cli(command, ["source", "rename", source_id, title, *_notebook_args(params), *_json_flag(params)])

    if action == "source_clean":
        args = ["source", "clean", *_notebook_args(params), *_json_flag(params)]
        _bool_flag(args, "--dry-run", params.get("dryRun") or params.get("dry_run"))
        _bool_flag(args, "-y", params.get("yes") or not (params.get("dryRun") or params.get("dry_run")))
        return _run_cli(command, args)

    if action in {"source_add_research", "add_research"}:
        query = params.get("query") or ""
        if not query:
            raise ValueError("source_add_research requires params.query")
        args = ["source", "add-research", *_notebook_args(params), *_json_flag(params)]
        _append_if_present(args, "--mode", params, "mode")
        _append_if_present(args, "--from", params, "from", "source")
        _append_if_present(args, "--timeout", params, "timeout")
        _bool_flag(args, "--import-all", params.get("importAll") or params.get("import_all"))
        _bool_flag(args, "--cited-only", params.get("citedOnly") or params.get("cited_only"))
        _bool_flag(args, "--no-wait", params.get("noWait") or params.get("no_wait"))
        return _run_cli(command, args, prompt_text=query)

    generate_aliases = {
        "generate_audio": "audio", "podcast": "audio",
        "generate_video": "video", "video": "video",
        "generate_cinematic_video": "cinematic-video", "cinematic_video": "cinematic-video",
        "generate_slide_deck": "slide-deck", "presentation": "slide-deck", "slides": "slide-deck",
        "generate_quiz": "quiz", "quiz": "quiz",
        "generate_flashcards": "flashcards", "flashcards": "flashcards",
        "generate_infographic": "infographic", "infographic": "infographic",
        "generate_data_table": "data-table", "data_table": "data-table",
        "generate_report": "report", "report": "report",
        "generate_mind_map": "mind-map", "mind_map": "mind-map",
    }
    if action in generate_aliases:
        args, prompt = _generate_args(generate_aliases[action], params)
        return _run_cli(command, args, prompt_text=prompt)

    if action in {"revise_slide", "generate_revise_slide"}:
        description = _required_param(params, "description", "prompt", "instructions")
        artifact_id = _required_param(params, "artifactId", "artifact_id", "artifact")
        slide = _required_param(params, "slide", "slideIndex", "slide_index")
        args = ["generate", "revise-slide", *_notebook_args(params), "--artifact", artifact_id, "--slide", slide, *_json_flag(params)]
        _bool_flag(args, "--wait", params.get("wait"))
        return _run_cli(command, args, prompt_text=description)

    if action in {"artifact_list", "artifacts"}:
        args = ["artifact", "list", *_notebook_args(params), *_json_flag(params)]
        _append_if_present(args, "--type", params, "type")
        _append_if_present(args, "--limit", params, "limit")
        _bool_flag(args, "--no-truncate", params.get("noTruncate") or params.get("no_truncate"))
        return _run_cli(command, args)

    if action in {"artifact_get", "artifact_poll", "artifact_wait", "artifact_delete"}:
        artifact_id = _required_param(params, "artifactId", "artifact_id", "taskId", "task_id", "id")
        subcommand = action.replace("artifact_", "")
        args = ["artifact", subcommand, artifact_id, *_notebook_args(params), *_json_flag(params)]
        if subcommand == "delete":
            args.append("-y")
        if subcommand == "wait":
            _append_if_present(args, "--timeout", params, "timeout")
            _append_if_present(args, "--interval", params, "interval")
        return _run_cli(command, args)

    if action == "artifact_rename":
        artifact_id = _required_param(params, "artifactId", "artifact_id", "id")
        title = _required_param(params, "title", "name")
        return _run_cli(command, ["artifact", "rename", artifact_id, title, *_notebook_args(params), *_json_flag(params)])

    if action == "artifact_export":
        artifact_id = _required_param(params, "artifactId", "artifact_id", "id")
        title = _required_param(params, "title", "name")
        args = ["artifact", "export", artifact_id, "--title", title, *_notebook_args(params), *_json_flag(params)]
        _append_if_present(args, "--type", params, "type")
        return _run_cli(command, args)

    if action == "artifact_suggestions":
        return _run_cli(command, ["artifact", "suggestions", *_notebook_args(params), *_json_flag(params)])

    if action in {"download", "download_artifact"}:
        kind = _required_param(params, "type", "kind").replace("_", "-")
        args = ["download", kind, *_notebook_args(params)]
        output_path = _artifact_output_path(kind, params)
        if output_path:
            args.append(output_path)
        _bool_flag(args, "--all", params.get("all"))
        _bool_flag(args, "--latest", params.get("latest"))
        _bool_flag(args, "--earliest", params.get("earliest"))
        _bool_flag(args, "--dry-run", params.get("dryRun") or params.get("dry_run"))
        _bool_flag(args, "--force", params.get("force"))
        _bool_flag(args, "--no-clobber", params.get("noClobber") or params.get("no_clobber"))
        _append_if_present(args, "-a", params, "artifactId", "artifact_id")
        _append_if_present(args, "--name", params, "name")
        _append_if_present(args, "--format", params, "format")
        args.extend(_json_flag(params))
        return _run_cli(command, args)

    if action in {"research_status", "research_wait"}:
        subcommand = action.replace("research_", "")
        args = ["research", subcommand, *_notebook_args(params), *_json_flag(params)]
        if subcommand == "wait":
            _append_if_present(args, "--timeout", params, "timeout")
            _append_if_present(args, "--interval", params, "interval")
            _bool_flag(args, "--import-all", params.get("importAll") or params.get("import_all"))
            _bool_flag(args, "--cited-only", params.get("citedOnly") or params.get("cited_only"))
        return _run_cli(command, args)

    if action == "share_status":
        return _run_cli(command, ["share", "status", *_notebook_args(params), *_json_flag(params)])

    if action == "share_public":
        args = ["share", "public", *_notebook_args(params), *_json_flag(params)]
        args.append("--enable" if params.get("enable", True) else "--disable")
        return _run_cli(command, args)

    if action == "share_view_level":
        level = _required_param(params, "level", "viewLevel", "view_level")
        return _run_cli(command, ["share", "view-level", level, *_notebook_args(params), *_json_flag(params)])

    if action == "share_add":
        email = _required_param(params, "email", "user")
        args = ["share", "add", email, *_notebook_args(params), *_json_flag(params)]
        _append_if_present(args, "--permission", params, "permission")
        _append_if_present(args, "-m", params, "message")
        _bool_flag(args, "--no-notify", params.get("noNotify") or params.get("no_notify"))
        return _run_cli(command, args)

    if action == "share_update":
        email = _required_param(params, "email", "user")
        args = ["share", "update", email, *_notebook_args(params), *_json_flag(params)]
        _append_if_present(args, "--permission", params, "permission")
        return _run_cli(command, args)

    if action == "share_remove":
        email = _required_param(params, "email", "user")
        return _run_cli(command, ["share", "remove", email, *_notebook_args(params), "-y", *_json_flag(params)])

    if action == "raw":
        args = params.get("args") or []
        if not isinstance(args, list) or not all(isinstance(item, str) for item in args):
            raise ValueError("raw requires params.args as a string array")
        blocked = {";", "&&", "||", "|", "`", "$", ">", "<"}
        if any(item in blocked for item in args):
            raise ValueError("raw args cannot contain shell control operators")
        return _run_cli(command, args, prompt_text=params.get("prompt"))

    raise ValueError(f"Unsupported NotebookLM action: {action}")


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, status: int, data: dict[str, Any]) -> None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send_json(200, {"ok": True})

    def do_POST(self) -> None:
        if self.path != "/notebooklm":
            self._send_json(404, {"ok": False, "error": "Not found"})
            return

        try:
            size = int(self.headers.get("Content-Length", "0"))
            if size > MAX_BODY_BYTES:
                raise ValueError("Request body is too large")
            payload = json.loads(self.rfile.read(size).decode("utf-8") or "{}")
            result = handle_notebooklm(payload)
            self._send_json(200 if result.get("ok") else 502, result)
        except Exception as exc:
            self._send_json(400, {"ok": False, "error": str(exc)})

    def log_message(self, fmt: str, *args: Any) -> None:
        print(f"NotebookLM bridge: {fmt % args}")


if __name__ == "__main__":
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"NotebookLM bridge listening on http://{HOST}:{PORT}/notebooklm")
    server.serve_forever()
