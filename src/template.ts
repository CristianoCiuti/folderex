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

export function renderDirectory(options: RenderOptions): string {
  const { entries, breadcrumbs } = options;

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

      return `
      <tr class="entry ${cls}">
        <td class="col-icon">${icon}</td>
        <td class="col-name"><a href="${href}">${entry.name}</a></td>
        <td class="col-size">${sizeStr}</td>
        <td class="col-date">${dateStr}</td>
      </tr>`;
    })
    .join("\n");

  const empty =
    entries.length === 0
      ? `<tr><td colspan="4" class="empty">This folder is empty</td></tr>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>folderex</title>
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

    footer {
      margin-top: 24px;
      text-align: center;
      font-size: 12px;
      color: var(--text-dim);
    }

    @media (max-width: 640px) {
      .col-date { display: none; }
      .col-size { width: 80px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <span class="logo">folderex</span>
      <nav class="breadcrumbs">${breadcrumbHtml}</nav>
    </header>
    <table>
      <thead>
        <tr>
          <th></th>
          <th>Name</th>
          <th style="text-align:right">Size</th>
          <th>Modified</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        ${empty}
      </tbody>
    </table>
    <footer>served by folderex</footer>
  </div>
</body>
</html>`;
}
