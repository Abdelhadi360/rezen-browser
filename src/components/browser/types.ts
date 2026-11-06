export type BrowserTab = {
  id: string;
  title: string;
  url: string | null;
  thumbnail?: string;
  pageColor?: string;
  pageSurfaceColor?: string;
  scrollY?: number;
  toolbarTextColor?: string;
  toolbarBackgroundColor?: string;
  websiteBackgroundColor?: string;
  websiteTextColor?: string;
};