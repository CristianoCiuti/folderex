export interface FileEntry {
  name: string;
  isDirectory: boolean;
  size: number;
  modified: string; // ISO string from server
}

export interface Breadcrumb {
  name: string;
  path: string;
}

export interface ListResponse {
  entries: FileEntry[];
  path: string;
  breadcrumbs: Breadcrumb[];
}
