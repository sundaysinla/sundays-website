import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID!;

export type Project = {
  number: string;
  name: string;
};

export async function getProjects(): Promise<Project[]> {
  try {
    const response = await notion.dataSources.query({
      data_source_id: PROJECTS_DB_ID,
      sorts: [{ property: "Order", direction: "ascending" }],
    });

    return response.results.map((page: any) => {
      const props = page.properties;
      const order = props.Order?.number ?? 0;
      const name =
        props.Name?.title?.[0]?.plain_text ?? "untitled";

      return {
        number: String(order).padStart(2, "0"),
        name,
      };
    });
  } catch (e) {
    console.error("Failed to fetch from Notion, using fallback:", e);
    return FALLBACK_PROJECTS;
  }
}

const FALLBACK_PROJECTS: Project[] = [
  { number: "01", name: "music production" },
  { number: "02", name: "font making" },
  { number: "03", name: "educational tools" },
  { number: "04", name: "website design" },
  { number: "05", name: "magic tricks" },
  { number: "06", name: "reading fiction" },
  { number: "07", name: "making matcha" },
  { number: "08", name: "3d modeling" },
];
