export type Manga = {
  id: string;
  title: string;
  originalTitle: string;
  description: string;
  cover: string | null;
  kind: string;
  status: string;
  year: number | null;
  tags: string[];
  languages: string[];
  url: string;
  rating?: number;
  followers?: number;
};
export type ReadingStatus = "planned" | "reading" | "completed";
export type CollectionItem = {
  manga: Manga;
  status: ReadingStatus;
  chapter: string;
  favorite: boolean;
  updatedAt: number;
};
export type Collection = Record<string, CollectionItem>;
export type Chapter = {
  volume?: string | null;
  alternatives?: Chapter[];
  id: string;
  number: string | null;
  title: string;
  language: string;
  group: string;
  url: string;
};
export type Release = { key: string; manga: Manga; chapter: Chapter; publishedAt: string };
