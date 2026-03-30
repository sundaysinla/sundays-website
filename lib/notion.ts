import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID!;

export type Project = {
  number: string;
  name: string;
  description?: string;
  image?: string;
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
        props["Project Title (Ideally 2 words)"]?.title?.[0]?.plain_text ??
        props.Name?.title?.[0]?.plain_text ?? "untitled";

      const description =
        props["1-line Description"]?.rich_text?.[0]?.plain_text ?? "";

      const imageFile =
        props["Image (JPG, PNG, or GIF)"]?.files?.[0] ??
        props["Image"]?.files?.[0];
      const image =
        imageFile?.file?.url ?? imageFile?.external?.url ?? "";

      return { number: String(order).padStart(2, "0"), name, description, image };
    });
  } catch (e) {
    console.error("Failed to fetch from Notion, using fallback:", e);
    return FALLBACK_PROJECTS;
  }
}

const FALLBACK_PROJECTS: Project[] = [
  { number: "01", name: "music production", description: "jamming on our favorite beats", image: "/maker-keyboard.png" },
  { number: "02", name: "making matcha", description: "building a campus matcha pop-up" },
  { number: "03", name: "educational tools", description: "did i spell that right?" },
  { number: "04", name: "website design", description: "making this website!", image: "/maker-laptop.png" },
  { number: "05", name: "magic tricks", description: "now you see me, now you don't" },
  { number: "06", name: "reading fiction", description: "food for the mind", image: "/maker-notebook.png" },
  { number: "07", name: "font making", description: "obsessing over pixels", image: "/maker-paintbrush.png" },
  { number: "08", name: "3d modeling", description: "bringing ideas to life" },
];
