import { Client } from "@notionhq/client";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

const PROJECTS_DB_ID = process.env.NOTION_PROJECTS_DB_ID!;

export type Creator = {
  name: string;
  url: string;
  profilePic?: string;
};

export type Project = {
  number: string;
  name: string;
  description?: string;
  image?: string;
  projectUrl?: string;
  creators?: Creator[];
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

      const projectUrl = props["Project URL"]?.url ?? "";

      const creators: Creator[] = [];
      const yourName = props["Your Name"]?.rich_text?.[0]?.plain_text ?? "";
      const yourUrl = props["Your LinkedIn, X, or Insta"]?.url ?? "";
      const yourPicFile = props["Your Profile Pic"]?.files?.[0];
      const yourPic = yourPicFile?.file?.url ?? yourPicFile?.external?.url ?? "";
      if (yourName) creators.push({ name: yourName, url: yourUrl, profilePic: yourPic || undefined });

      const addtlName = props["Additional Creator Name?"]?.rich_text?.[0]?.plain_text ?? "";
      const addtlUrl = props["Additional LinkedIn, X, or Insta"]?.url ?? "";
      const addtlPicFile = props["Additional Creator Profile Pic"]?.files?.[0];
      const addtlPic = addtlPicFile?.file?.url ?? addtlPicFile?.external?.url ?? "";
      if (addtlName) creators.push({ name: addtlName, url: addtlUrl, profilePic: addtlPic || undefined });

      return {
        number: String(order).padStart(2, "0"),
        name,
        description,
        image,
        projectUrl: projectUrl || undefined,
        creators: creators.length > 0 ? creators : undefined,
      };
    });
  } catch (e) {
    console.error("Failed to fetch from Notion, using fallback:", e);
    return FALLBACK_PROJECTS;
  }
}

const FALLBACK_PROJECTS: Project[] = [
  { number: "01", name: "music production", description: "jamming on our favorite beats", image: "/maker-keyboard.png" },
  { number: "02", name: "making matcha", description: "building a campus matcha pop-up", creators: [{ name: "jayson tian", url: "https://x.com/jaezun_" }, { name: "michelle liu", url: "https://x.com/michelletliu" }] },
  { number: "03", name: "educational tools", description: "did i spell that right?", creators: [{ name: "sam cheng", url: "https://x.com/samfcheng" }] },
  { number: "04", name: "website design", description: "making this website!", image: "/maker-laptop.png" },
  { number: "05", name: "magic tricks", description: "now you see me, now you don't", creators: [{ name: "amanda nepo", url: "https://www.instagram.com/amandanepo.magic/" }] },
  { number: "06", name: "reading fiction", description: "food for the mind", image: "/maker-notebook.png" },
  { number: "07", name: "font making", description: "obsessing over pixels", image: "/maker-paintbrush.png", creators: [{ name: "jacqueline guo", url: "https://x.com/jacqfolio" }] },
  { number: "08", name: "3d modeling", description: "bringing ideas to life" },
];
