export interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

interface Breadcrumb {
  name: string;
  path: string;
}

interface RenderOptions {
  entries: FileEntry[];
  path: string;
  breadcrumbs: Breadcrumb[];
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function formatDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function getIcon(entry: FileEntry): string {
  if (entry.isDirectory) return "folder";

  const ext = entry.name.split(".").pop()?.toLowerCase() || "";
  const iconMap: Record<string, string> = {
    // Code
    js: "code",
    ts: "code",
    jsx: "code",
    tsx: "code",
    py: "code",
    rb: "code",
    go: "code",
    rs: "code",
    java: "code",
    c: "code",
    cpp: "code",
    h: "code",
    cs: "code",
    php: "code",
    swift: "code",
    kt: "code",
    vue: "code",
    svelte: "code",
    // Web
    html: "web",
    htm: "web",
    css: "web",
    scss: "web",
    less: "web",
    // Data
    json: "data",
    xml: "data",
    yaml: "data",
    yml: "data",
    csv: "data",
    sql: "data",
    toml: "data",
    // Docs
    md: "doc",
    txt: "doc",
    pdf: "doc",
    doc: "doc",
    docx: "doc",
    rtf: "doc",
    // Images
    png: "image",
    jpg: "image",
    jpeg: "image",
    gif: "image",
    svg: "image",
    webp: "image",
    ico: "image",
    bmp: "image",
    // Archives
    zip: "archive",
    tar: "archive",
    gz: "archive",
    rar: "archive",
    "7z": "archive",
    bz2: "archive",
    // Config
    env: "config",
    gitignore: "config",
    dockerignore: "config",
    editorconfig: "config",
    // Media
    mp4: "media",
    mp3: "media",
    wav: "media",
    avi: "media",
    mkv: "media",
  };

  return iconMap[ext] || "file";
}

function svgIcon(type: string): string {
  const icons: Record<string, string> = {
    folder: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-folder"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,
    file: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-file"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`,
    code: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-code"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`,
    image: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-image"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    doc: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-doc"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    data: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-data"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`,
    web: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-web"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,
    archive: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-archive"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,
    config: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-config"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    media: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="icon icon-media"><polygon points="5 3 19 12 5 21 5 3"/></svg>`,
  };

  return icons[type] || icons.file;
}

function actionIcons(): { share: string; download: string; trash: string } {
  return {
    share: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    download: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    trash: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  };
}

export function renderDirectory(options: RenderOptions): string {
  const { entries, path: currentPath, breadcrumbs } = options;
  const icons = actionIcons();

  const breadcrumbHtml = breadcrumbs
    .map(
      (b, i) =>
        i === breadcrumbs.length - 1
          ? `<span class="crumb current">${b.name}</span>`
          : `<a href="${b.path}" class="crumb">${b.name}</a>`
    )
    .join(`<span class="sep">/</span>`);

  const rows = entries
    .map((entry) => {
      const icon = svgIcon(getIcon(entry));
      const href = entry.isDirectory
        ? `${encodeURIComponent(entry.name)}/`
        : encodeURIComponent(entry.name);
      const sizeStr = entry.isDirectory ? "-" : formatSize(entry.size);
      const dateStr = formatDate(entry.modified);
      const cls = entry.isDirectory ? "dir" : "file";

      // Build full resource path for share/download
      const resourcePath = currentPath === "/"
        ? `/${encodeURIComponent(entry.name)}${entry.isDirectory ? "/" : ""}`
        : `${currentPath}${encodeURIComponent(entry.name)}${entry.isDirectory ? "/" : ""}`;
      const downloadPath = `/__download${currentPath}${encodeURIComponent(entry.name)}${entry.isDirectory ? "/" : ""}`;

      return `
      <tr class="entry ${cls}">
        <td class="col-icon">${icon}</td>
        <td class="col-name"><a href="${href}">${entry.name}</a></td>
        <td class="col-size">${sizeStr}</td>
        <td class="col-date">${dateStr}</td>
        <td class="col-actions">
          <button class="btn-action btn-share" title="Copy link" onclick="shareUrl('${resourcePath.replace(/'/g, "\\'")}')">${icons.share}</button>
          <a class="btn-action btn-download" title="Download" href="${downloadPath}">${icons.download}</a>
          <button class="btn-action btn-delete" title="Delete" onclick="deleteEntry('${resourcePath.replace(/'/g, "\\'")}', '${entry.name.replace(/'/g, "\\'")}')">${icons.trash}</button>
        </td>
      </tr>`;
    })
    .join("\n");

  const empty =
    entries.length === 0
      ? `<tr><td colspan="5" class="empty">This folder is empty</td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>folderex</title>
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='none' stroke='%233fb950' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'/%3E%3Cpath d='M12 11v6'/%3E%3Cpath d='M9 14l3-3 3 3'/%3E%3C/svg%3E">
  <script>(function(){var p=localStorage.getItem("folderex-theme")||"system",t=p==="system"?(matchMedia("(prefers-color-scheme:light)").matches?"light":"dark"):p;document.documentElement.setAttribute("data-theme",t)})()</script>
  <style>
    :root {
      --bg: #0d1117;
      --surface: #161b22;
      --border: #30363d;
      --text: #e6edf3;
      --text-dim: #7d8590;
      --accent: #58a6ff;
      --accent-hover: #79c0ff;
      --folder: #e3b341;
      --hover-bg: #1c2129;
      --green: #3fb950;
    }

    [data-theme="light"] {
      --bg: #ffffff;
      --surface: #f6f8fa;
      --border: #d0d7de;
      --text: #1f2328;
      --text-dim: #656d76;
      --accent: #0969da;
      --accent-hover: #0550ae;
      --folder: #9a6700;
      --hover-bg: #eef1f4;
      --green: #1a7f37;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
      min-height: 100vh;
    }

    .container {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px 16px;
    }

    header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 20px;
      padding-bottom: 16px;
      border-bottom: 1px solid var(--border);
    }

    .logo {
      font-size: 18px;
      font-weight: 700;
      color: var(--green);
      letter-spacing: -0.5px;
    }

    .breadcrumbs {
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 4px;
      flex-wrap: wrap;
    }

    .crumb {
      color: var(--accent);
      text-decoration: none;
      padding: 2px 6px;
      border-radius: 4px;
    }

    .crumb:hover {
      background: var(--hover-bg);
      color: var(--accent-hover);
    }

    .crumb.current {
      color: var(--text);
    }

    .sep {
      color: var(--text-dim);
      font-size: 12px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
      font-size: 14px;
    }

    thead th {
      text-align: left;
      padding: 10px 12px;
      background: var(--surface);
      color: var(--text-dim);
      font-weight: 500;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid var(--border);
    }

    tr.entry {
      border-bottom: 1px solid var(--border);
      transition: background 0.1s;
    }

    tr.entry:last-child {
      border-bottom: none;
    }

    tr.entry:hover {
      background: var(--hover-bg);
    }

    td {
      padding: 8px 12px;
      vertical-align: middle;
    }

    .col-icon {
      width: 32px;
      text-align: center;
      padding-right: 0;
    }

    .col-name {
      font-weight: 400;
    }

    .col-name a {
      text-decoration: none;
      color: var(--accent);
    }

    .col-name a:hover {
      text-decoration: underline;
      color: var(--accent-hover);
    }

    .dir .col-name a {
      font-weight: 500;
    }

    .col-size, .col-date {
      color: var(--text-dim);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .col-size {
      width: 100px;
      text-align: right;
    }

    .col-date {
      width: 160px;
    }

    .col-actions {
      width: 110px;
      white-space: nowrap;
      text-align: right;
    }

    .btn-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border: none;
      background: transparent;
      color: var(--text-dim);
      border-radius: 6px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      text-decoration: none;
      vertical-align: middle;
    }

    .btn-action:hover {
      background: var(--border);
      color: var(--text);
    }

    .btn-share.copied {
      color: var(--green);
    }

    .btn-delete:hover {
      color: #f85149;
      background: rgba(248, 81, 73, 0.1);
    }

    /* --- Upload button --- */
    .btn-upload {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-dim);
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
      margin-right: 8px;
    }

    .btn-upload:hover {
      background: var(--hover-bg);
      color: var(--text);
      border-color: var(--text-dim);
    }

    .btn-upload svg { display: block; }

    /* --- Drop zone overlay --- */
    .drop-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: color-mix(in srgb, var(--bg) 65%, transparent);
      backdrop-filter: blur(1px);
      z-index: 900;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 12px;
    }

    .drop-overlay.active {
      display: flex;
    }

    .drop-overlay-box {
      border: 2px dashed var(--accent);
      border-radius: 16px;
      padding: 48px 64px;
      text-align: center;
      color: var(--text);
    }

    .drop-overlay-box svg {
      margin-bottom: 12px;
      color: var(--accent);
    }

    .drop-overlay-text {
      font-size: 16px;
      font-weight: 500;
    }

    .drop-overlay-sub {
      font-size: 13px;
      color: var(--text-dim);
      margin-top: 4px;
    }

    .icon {
      display: block;
    }

    .icon-folder { color: var(--folder); }
    .icon-code { color: #bc8cff; }
    .icon-image { color: #f778ba; }
    .icon-doc { color: #79c0ff; }
    .icon-data { color: #56d364; }
    .icon-web { color: #ff7b72; }
    .icon-archive { color: #d29922; }
    .icon-config { color: #7d8590; }
    .icon-media { color: #f778ba; }
    .icon-file { color: #7d8590; }

    .empty {
      text-align: center;
      padding: 40px 16px;
      color: var(--text-dim);
    }

    /* --- Shared Clipboard --- */
    .clipboard-section {
      margin-top: 24px;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }

    .clipboard-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
      cursor: pointer;
      user-select: none;
    }

    .clipboard-header:hover {
      background: var(--hover-bg);
    }

    .clipboard-title {
      font-size: 12px;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--text-dim);
    }

    .clipboard-toggle {
      font-size: 10px;
      color: var(--text-dim);
      margin-left: auto;
    }

    .clipboard-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--text-dim);
      transition: background 0.3s;
    }

    .clipboard-dot.connected {
      background: var(--green);
    }

    .clipboard-body {
      display: block;
    }

    .clipboard-body.collapsed {
      display: none;
    }

    .clipboard-body textarea {
      width: 100%;
      min-height: 100px;
      padding: 12px 14px;
      background: var(--bg);
      color: var(--text);
      border: none;
      font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
      font-size: 13px;
      line-height: 1.6;
      resize: vertical;
      outline: none;
    }

    .clipboard-body textarea::placeholder {
      color: var(--text-dim);
    }

    /* --- Toast notification --- */
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(80px);
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      padding: 8px 20px;
      border-radius: 8px;
      font-size: 13px;
      opacity: 0;
      transition: transform 0.25s ease, opacity 0.25s ease;
      pointer-events: none;
      z-index: 1000;
    }

    .toast.show {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    footer {
      margin-top: 24px;
      text-align: center;
      font-size: 12px;
      color: var(--text-dim);
    }

    /* --- Theme toggle --- */
    .header-right {
      margin-left: auto;
      display: flex;
      align-items: center;
    }

    .theme-toggle {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 34px;
      height: 34px;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text-dim);
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.15s, color 0.15s, border-color 0.15s;
    }

    .theme-toggle:hover {
      background: var(--hover-bg);
      color: var(--text);
      border-color: var(--text-dim);
    }

    .theme-toggle svg { display: block; }

    .theme-icon { display: none; }
    [data-theme="dark"] .theme-icon-moon { display: block; }
    [data-theme="light"] .theme-icon-sun { display: block; }

    .theme-label {
      font-size: 10px;
      color: var(--text-dim);
      margin-right: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* --- Logo icon --- */
    .logo-wrap {
      display: flex;
      align-items: center;
      gap: 7px;
    }

    .logo-icon {
      color: var(--green);
      display: block;
    }

    @media (max-width: 640px) {
      .col-date { display: none; }
      .col-size { width: 80px; }
      .col-actions { width: 60px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-wrap">
        <svg class="logo-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><path d="M12 11v6"/><path d="M9 14l3-3 3 3"/></svg>
        <span class="logo">folderex</span>
      </div>
      <nav class="breadcrumbs">${breadcrumbHtml}</nav>
      <div class="header-right">
        <button class="btn-upload" onclick="triggerUpload()" title="Upload files">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload
        </button>
        <span class="theme-label" id="themeLabel"></span>
        <button class="theme-toggle" onclick="cycleTheme()" title="Switch theme" id="themeBtn">
          <svg class="theme-icon theme-icon-moon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          <svg class="theme-icon theme-icon-sun" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          <svg class="theme-icon theme-icon-system" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        </button>
      </div>
    </header>
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Name</th>
          <th style="text-align:right">Size</th>
          <th>Modified</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${empty}
      </tbody>
    </table>

    <div class="clipboard-section">
      <div class="clipboard-header" onclick="toggleClipboard()">
        <span class="clipboard-dot" id="wsDot"></span>
        <span class="clipboard-title">Shared Clipboard</span>
        <span class="clipboard-toggle" id="clipToggleLabel">Hide</span>
      </div>
      <div class="clipboard-body" id="clipBody">
        <textarea id="sharedClipboard" placeholder="Type here... content is shared with all connected clients in real time."></textarea>
      </div>
    </div>

    <footer>served by folderex</footer>
  </div>

  <div class="toast" id="toast"></div>

  <div class="drop-overlay" id="dropOverlay">
    <div class="drop-overlay-box">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <div class="drop-overlay-text">Drop files to upload</div>
      <div class="drop-overlay-sub">Files will be uploaded to the current directory</div>
    </div>
  </div>

  <input type="file" id="fileInput" multiple style="display:none">

  <script>
    // --- Theme ---
    function getThemePref() { return localStorage.getItem("folderex-theme") || "system"; }

    function applyTheme(pref) {
      var effective = pref;
      if (pref === "system") {
        effective = matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
      }
      document.documentElement.setAttribute("data-theme", effective);
      // Update icon visibility: hide all, show current
      var icons = document.querySelectorAll(".theme-icon");
      for (var i = 0; i < icons.length; i++) icons[i].style.display = "none";
      if (pref === "system") {
        document.querySelector(".theme-icon-system").style.display = "block";
      } else if (effective === "dark") {
        document.querySelector(".theme-icon-moon").style.display = "block";
      } else {
        document.querySelector(".theme-icon-sun").style.display = "block";
      }
      // Update label
      var labels = { dark: "Dark", light: "Light", system: "Auto" };
      document.getElementById("themeLabel").textContent = labels[pref] || "";
    }

    function cycleTheme() {
      var order = ["dark", "light", "system"];
      var cur = getThemePref();
      var next = order[(order.indexOf(cur) + 1) % order.length];
      localStorage.setItem("folderex-theme", next);
      applyTheme(next);
    }

    // React to OS theme changes when in system mode
    matchMedia("(prefers-color-scheme: light)").addEventListener("change", function() {
      if (getThemePref() === "system") applyTheme("system");
    });

    // Apply on page load
    applyTheme(getThemePref());

    // --- Toast ---
    function showToast(msg) {
      var t = document.getElementById("toast");
      t.textContent = msg;
      t.classList.add("show");
      setTimeout(function() { t.classList.remove("show"); }, 1800);
    }

    // --- Share (copy URL) ---
    function shareUrl(resourcePath) {
      var url = location.origin + resourcePath;
      navigator.clipboard.writeText(url).then(function() {
        showToast("Link copied");
      }).catch(function() {
        // Fallback for older browsers / non-HTTPS
        var tmp = document.createElement("input");
        tmp.value = url;
        document.body.appendChild(tmp);
        tmp.select();
        document.execCommand("copy");
        document.body.removeChild(tmp);
        showToast("Link copied");
      });
    }

    // --- Clipboard toggle ---
    function toggleClipboard() {
      var body = document.getElementById("clipBody");
      var label = document.getElementById("clipToggleLabel");
      body.classList.toggle("collapsed");
      label.textContent = body.classList.contains("collapsed") ? "Show" : "Hide";
    }

    // --- Refresh file list without full reload ---
    function refreshFileList() {
      fetch(location.href, { credentials: "same-origin" })
        .then(function(res) { return res.text(); })
        .then(function(html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, "text/html");
          var newTbody = doc.querySelector("tbody");
          var newBreadcrumbs = doc.querySelector(".breadcrumbs");
          if (newTbody) {
            document.querySelector("tbody").innerHTML = newTbody.innerHTML;
          }
          if (newBreadcrumbs) {
            document.querySelector(".breadcrumbs").innerHTML = newBreadcrumbs.innerHTML;
          }
        })
        .catch(function() {
          // Fallback to full reload if fetch fails
          location.reload();
        });
    }

    // --- Delete ---
    function deleteEntry(resourcePath, name) {
      if (!confirm("Delete \\\"" + name + "\\\"?")) return;
      fetch("/__api/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: resourcePath })
      })
      .then(function(res) {
        if (!res.ok) return res.json().then(function(d) { throw new Error(d.error || "Delete failed"); });
        return res.json();
      })
      .then(function() {
        showToast("Deleted");
        refreshFileList();
      })
      .catch(function(err) {
        showToast("Error: " + err.message);
      });
    }

    // --- Upload ---
    var currentPath = "${currentPath.replace(/"/g, '\\"')}";

    function triggerUpload() {
      document.getElementById("fileInput").click();
    }

    function uploadFiles(files, overwrite, pendingToken) {
      var fd = new FormData();
      fd.append("path", currentPath);
      if (overwrite) fd.append("overwrite", "true");
      if (pendingToken) {
        fd.append("pendingToken", pendingToken);
      } else {
        for (var i = 0; i < files.length; i++) {
          fd.append("files", files[i]);
        }
      }
      fetch("/__api/upload", { method: "POST", body: fd })
        .then(function(res) {
          if (res.status === 409) {
            return res.json().then(function(data) {
              var names = data.conflicts.join(", ");
              if (confirm(names + " already exist(s). Overwrite?")) {
                uploadFiles(null, true, data.pendingToken);
              }
              return null;
            });
          }
          if (!res.ok) return res.json().then(function(d) { throw new Error(d.error || "Upload failed"); });
          return res.json();
        })
        .then(function(data) {
          if (data && data.ok) {
            showToast(data.files.length + " file(s) uploaded");
            refreshFileList();
          }
        })
        .catch(function(err) {
          showToast("Error: " + err.message);
        });
    }

    document.getElementById("fileInput").addEventListener("change", function(e) {
      var files = e.target.files;
      if (files.length > 0) uploadFiles(files, false, null);
      e.target.value = "";
    });

    // --- Drag & Drop ---
    (function() {
      var overlay = document.getElementById("dropOverlay");
      var dragCount = 0;

      document.addEventListener("dragenter", function(e) {
        e.preventDefault();
        dragCount++;
        if (dragCount === 1) overlay.classList.add("active");
      });

      document.addEventListener("dragleave", function(e) {
        e.preventDefault();
        dragCount--;
        if (dragCount <= 0) { dragCount = 0; overlay.classList.remove("active"); }
      });

      document.addEventListener("dragover", function(e) {
        e.preventDefault();
      });

      document.addEventListener("drop", function(e) {
        e.preventDefault();
        dragCount = 0;
        overlay.classList.remove("active");
        var files = e.dataTransfer.files;
        if (files.length > 0) uploadFiles(files, false, null);
      });
    })();

    // --- WebSocket ---
    (function() {
      var ta = document.getElementById("sharedClipboard");
      var dot = document.getElementById("wsDot");
      var ws;
      var reconnectDelay = 1000;
      var debounceTimer = null;
      var ignoreNextInput = false;

      function connect() {
        var proto = location.protocol === "https:" ? "wss:" : "ws:";
        var wsUrl = proto + "//" + location.host + "/__ws";

        // Pass auth via protocol (basic auth headers not available in browser WebSocket)
        // Instead, we send credentials as first message
        ws = new WebSocket(wsUrl);

        ws.onopen = function() {
          dot.classList.add("connected");
          reconnectDelay = 1000;
        };

        ws.onclose = function() {
          dot.classList.remove("connected");
          setTimeout(connect, reconnectDelay);
          reconnectDelay = Math.min(reconnectDelay * 2, 10000);
        };

        ws.onerror = function() {
          ws.close();
        };

        ws.onmessage = function(ev) {
          try {
            var msg = JSON.parse(ev.data);
            if (msg.type === "clipboard") {
              ignoreNextInput = true;
              // Preserve cursor position
              var start = ta.selectionStart;
              var end = ta.selectionEnd;
              ta.value = msg.text;
              ta.selectionStart = start;
              ta.selectionEnd = end;
              ignoreNextInput = false;
            } else if (msg.type === "fschange") {
              refreshFileList();
            }
          } catch(e) {}
        };
      }

      // Send clipboard changes with debounce
      ta.addEventListener("input", function() {
        if (ignoreNextInput) return;
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "clipboard", text: ta.value }));
          }
        }, 150);
      });

      connect();
    })();
  </script>
</body>
</html>`;
}
