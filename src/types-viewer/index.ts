export interface Config {
  zones: Record<string, string[]>;
  levels: Record<string, string[]>;
  category: Record<string, string[]>;
  progress: Record<string, number[]>;
  filter: string[];
  forceInProgressKeywords?: string[];
}

export interface MappedResult {
  zone: string;
  level: string;
  category: string[];
  status: "IN_PROGRESS" | "COMPLETED";
}

export interface ModelFile {
  frag: string;
  json: string;
}
