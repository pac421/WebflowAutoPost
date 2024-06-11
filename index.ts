import dotenv from "dotenv";
import fs from "fs";
import { JSDOM } from "jsdom";
import { parse } from "node-html-parser";
import OpenAI from "openai";

const TESTING_MODE = false;
const WEBFLOW_BLOG_COLLECTION_ID = "665f2bee7532c57800729dbf";
const WEBFLOW_BLOG_ORIGINAL_LINK_FIELD = "autopostgeneratororiginallink";
const OPENAI_GPT_MODEL = "gpt-4o";

dotenv.config(); // Load environment variables from .env file

if (!process.env.OPENAI_API_KEY)
  throw new Error("OPENAI_API_KEY is not set in the environment variables");

if (!process.env.WEBFLOW_API_KEY)
  throw new Error("WEBFLOW_API_KEY is not set in the environment variables");

type BlogSite = {
  id: string;
  name: string;
  domain: string;
  blogPageUrl: string;
  blogPageLinkSelector: string;
  postPageTitleSelector: string;
  postPageHtmlContentSelector: string;
};

let BLOG_SITES: BlogSite[] = [];

if (BLOG_SITES.length === 0) {
  throw new Error("No blog site is defined!");
}

type Post = {
  title: string;
  htmlContent: string;
};

type OriginalPost = Post & {
  originalLink: string;
};

type ReformulatedPost = Post & {
  thumbnailUrl?: string;
};

type PostBuffer = Record<
  string,
  { original: OriginalPost; reformulated: ReformulatedPost }[]
>;

async function fetchBlogPage(blogPageUrl: string): Promise<string> {
  console.log("Fetching blog page..");
  const res = await fetch(blogPageUrl);
  const content = await res.text();
  return content;
}

function extractPostLinksFromBlogPageContent(
  blogsite: BlogSite,
  blogPageContent: string
): string[] {
  console.log("Extracting post links..");
  const dom = parse(blogPageContent);
  const linksElements = dom.querySelectorAll(blogsite.blogPageLinkSelector);
  const links = linksElements
    .map((el) => el.getAttribute("href") || "")
    .filter((link) => link !== "")
    .map((link) => {
      // If the link is a relative URL, convert it to an absolute URL
      if (!link.startsWith("http")) {
        link = `https://${blogsite.domain}${link}`;
      }
      return link;
    });
  console.log("links: ", links);
  return links;
}

async function fetchAllPostOnWebflow(): Promise<any[]> {
  console.log("Fetching all posts on Webflow..");
  const res = await fetch(
    `https://api.webflow.com/v2/collections/${WEBFLOW_BLOG_COLLECTION_ID}/items`,
    {
      headers: {
        Authorization: `Bearer ${process.env.WEBFLOW_API_KEY}`,
      },
    }
  );
  const data = await res.json();
  console.log("data: ", data);
  return data.items || [];
}

async function filterNewPostLinks(postLinks: string[]): Promise<string[]> {
  console.log("Filtering new post links..");
  const posts = await fetchAllPostOnWebflow();
  const links = posts.map(
    (post) => post.fieldData[WEBFLOW_BLOG_ORIGINAL_LINK_FIELD]
  );
  console.log("already known links: ", links);
  const newPostLinks = postLinks.filter((link) => !links.includes(link));
  console.log("new post links: ", newPostLinks);
  return newPostLinks;
}

async function fetchPostPage(postLink: string): Promise<string> {
  console.log("Fetching post page..");
  const res = await fetch(postLink);
  const content = await res.text();
  return content;
}

// Function to clean the HTML string by removing unwanted attributes, script/style tags, and comments
function cleanHTML(html: string): string {
  // Remove all HTML comments
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  // Remove all CSS comments within <style> tags
  html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, (match) => {
    return match.replace(/\/\*[\s\S]*?\*\//g, "");
  });

  // Remove all <script> and <style> tags completely
  html = html.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "");
  html = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");

  // Parse the cleaned HTML string into a document
  const dom = new JSDOM(html);
  const document = dom.window.document;

  // Recursive function to process each element and its children
  const processElement = (element: Element) => {
    // Get all the attributes of the element
    const attributes = element.attributes;

    // Iterate over the attributes in reverse order to safely remove them
    for (let i = attributes.length - 1; i >= 0; i--) {
      const attr = attributes[i];
      // Remove the attribute if it is not "style"
      if (attr.name !== "style") {
        element.removeAttribute(attr.name);
      }
    }

    // Remove CSS comments from the style attribute
    if (element.hasAttribute("style")) {
      const styleValue = element.getAttribute("style")!;
      const cleanedStyleValue = styleValue.replace(/\/\*[\s\S]*?\*\//g, "");
      element.setAttribute("style", cleanedStyleValue);
    }

    // Process all child elements recursively
    for (let i = 0; i < element.children.length; i++) {
      processElement(element.children[i]);
    }
  };

  // Start processing from the document's body
  processElement(document.body);

  // Return the cleaned HTML as a string
  return document.body.innerHTML;
}

function extractPostDetailsFromPostPageContent(
  originalLink: string,
  postPageContent: string,
  blogSite: BlogSite
): OriginalPost | null {
  console.log("Extracting post details..");
  const dom = parse(postPageContent);
  const title = dom.querySelector(blogSite.postPageTitleSelector)?.text || null;
  if (!title) {
    console.log("Post title not found!");
    return null;
  }
  let htmlContent = dom
    .querySelectorAll(blogSite.postPageHtmlContentSelector)
    .map((el) => el.toString())
    .join("");
  if (!htmlContent) {
    console.log("Post content not found!");
    return null;
  }
  htmlContent = cleanHTML(htmlContent);
  const post: OriginalPost = {
    originalLink,
    title,
    htmlContent,
  };
  console.log("post: ", post);
  return post;
}

async function stealPosts(blogSite: BlogSite): Promise<OriginalPost[]> {
  const blogPageContent: string = await fetchBlogPage(blogSite.blogPageUrl);
  const postLinks = extractPostLinksFromBlogPageContent(
    blogSite,
    blogPageContent
  );

  let newPostLinks = await filterNewPostLinks(postLinks);
  newPostLinks = TESTING_MODE ? newPostLinks.slice(0, 1) : newPostLinks;

  const posts: OriginalPost[] = [];
  for (const postLink of newPostLinks) {
    const rand = Math.floor(Math.random() * 3000) + 1000;
    console.log(`Waiting for ${rand} ms before fetching the next post..`);
    await new Promise((resolve) => setTimeout(resolve, rand));

    const postPageContent: string = await fetchPostPage(postLink);
    const post = extractPostDetailsFromPostPageContent(
      postLink,
      postPageContent,
      blogSite
    );
    if (!post) {
      console.log("Post details not extracted!");
      continue;
    }
    posts.push(post);
  }
  return posts;
}

async function reformulatePostTitle(
  websiteName: string,
  postTitle: string,
  openai: OpenAI
): Promise<string | null> {
  console.log("Reformulating the post title..");
  const context: string = `Ton rôle est de reformuler le titre suivant en utilisant des mots différents mais en conservant le sens de la phrase. Retire aussi toutes les mentions concernant ${websiteName}. Voici le titre à reformuler :`;
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: `${context} ${postTitle}` }],
    model: OPENAI_GPT_MODEL,
  });
  console.log("chatCompletion: ", chatCompletion);
  const reformulatedPostTitle = chatCompletion.choices[0].message.content;
  console.log("reformulatedPostTitle: ", reformulatedPostTitle);
  return reformulatedPostTitle;
}

async function reformulatePostContent(
  websiteName: string,
  postContent: string,
  openai: OpenAI
): Promise<string | null> {
  console.log("Reformulating the post content..");
  const context: string = `Ton role est de reformuler intégralement le texte présent dans l'HTML suivant, en utilisant des mots différents mais en conservant le sens des phrases. Retire aussi toutes les mentions concernant ${websiteName}. Tu ne dois surtout pas changé la structure HTML ni le contenu CSS. Voici le texte à reformuler :`;
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: `${context} ${postContent}` }],
    model: OPENAI_GPT_MODEL,
  });
  console.log("chatCompletion: ", chatCompletion);
  let reformulatedPostContent = chatCompletion.choices[0].message.content;
  if (!reformulatedPostContent) return null;
  reformulatedPostContent = reformulatedPostContent.replace(/^```html\n/, "");
  reformulatedPostContent = reformulatedPostContent.replace(/```$/, "");
  reformulatedPostContent = reformulatedPostContent.replace(/\n/g, "");
  console.log("reformulatedPostContent: ", reformulatedPostContent);
  return reformulatedPostContent;
}

async function reformulatePost(
  blogSite: BlogSite,
  post: OriginalPost,
  openai: OpenAI
): Promise<ReformulatedPost | null> {
  console.log("Reformulating the post..");
  const reformulatedPostTitle = await reformulatePostTitle(
    blogSite.name,
    post.title,
    openai
  );
  if (!reformulatedPostTitle) return null;
  const reformulatedHtmlContent = await reformulatePostContent(
    blogSite.name,
    post.htmlContent,
    openai
  );
  if (!reformulatedHtmlContent) return null;
  return {
    title: reformulatedPostTitle,
    htmlContent: reformulatedHtmlContent,
  };
}

async function generatePostThumbnail(
  postTitle: string,
  openai: OpenAI
): Promise<string | null> {
  console.log("Generating post thumbnail..");
  const prompt: string = `Génère une image de couverture pour un article de blog sur le sujet suivant : ${postTitle}`;
  const response = await openai.images.generate({
    model: "dall-e-3",
    prompt,
    n: 1,
    size: "1024x1024",
  });
  console.log("response: ", response);
  const imageUrl = response.data[0].url;
  console.log("imageUrl: ", imageUrl);
  return imageUrl || null;
}

function getSummaryFromLongText(text: string): string {
  const maxLength = 300;
  return text.length > maxLength ? text.slice(0, maxLength) + "..." : text;
}

async function publishPostOnWebflow(postId: string) {
  console.log("Publishing the post on Webflow..");
  const payload = {
    itemIds: [postId],
  };
  console.log("payload: ", payload);
  const res = await fetch(
    `https://api.webflow.com/v2/collections/${WEBFLOW_BLOG_COLLECTION_ID}/items/publish`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WEBFLOW_API_KEY}`,
      },
      body: JSON.stringify(payload),
    }
  );
  console.log("res: ", res);
  if (!res.ok) {
    console.error("Error publishing post on Webflow!", res.statusText);
    return;
  }
  const data = await res.json();
  console.log("Post published successfully on Webflow!", data);
  return data;
}

function removeHtmlFromText(text: string): string {
  return text.replace(/<[^>]*>?/gm, "");
}

async function createPostOnWebflow(
  originalLink: string,
  post: ReformulatedPost
) {
  if (!post.thumbnailUrl) {
    console.log(
      "Skip creating post on Webflow because thumbnailUrl is not available"
    );
    return;
  }
  console.log("Creating the post on Webflow..");
  const payload: any = {
    fieldData: {
      name: post.title,
      "author-name": "testa",
      "post-summary": getSummaryFromLongText(
        removeHtmlFromText(post.htmlContent)
      ),
      "rich-text": post.htmlContent,
      "main-image-2": {
        url: post.thumbnailUrl,
      },
      "thumbnail-image": {
        url: post.thumbnailUrl,
      },
    },
  };
  payload.fieldData[WEBFLOW_BLOG_ORIGINAL_LINK_FIELD] = originalLink;
  console.log("payload: ", payload);
  const res = await fetch(
    `https://api.webflow.com/v2/collections/${WEBFLOW_BLOG_COLLECTION_ID}/items`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WEBFLOW_API_KEY}`,
      },
      body: JSON.stringify(payload),
    }
  );
  console.log("res: ", res);
  if (!res.ok) {
    console.error("Error creating post on Webflow!", res.statusText);
    return;
  }
  const data = await res.json();
  console.log("Post created successfully on Webflow!", data);
  await publishPostOnWebflow(data.id);
}

function writeNewLogFile(buffer: PostBuffer) {
  console.log("Writing the new log file..");
  // Get the current date and time as iso string
  const now = new Date().toISOString();
  // Create a new file name with the current date and time in folder "logs"
  const fileName = `logs/log-${now}.json`;
  // Create logs folder if it doesn't exist
  if (!fs.existsSync("logs")) {
    fs.mkdirSync("logs");
  }
  // Write the buffer to the new file
  fs.writeFileSync(fileName, JSON.stringify(buffer, null, 2));
  console.log("New log file written successfully!");
}

async function init() {
  const buffer: PostBuffer = {};
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  // If testing mode is enabled, only process the first blog site and the first post
  BLOG_SITES = TESTING_MODE ? BLOG_SITES.slice(0, 1) : BLOG_SITES;
  for (const blogSite of BLOG_SITES) {
    console.log(`Stealing posts from ${blogSite.name}..`);
    let originalPosts = await stealPosts(blogSite);
    if (originalPosts.length === 0) continue;
    // reduce the number of post in post array to 1
    originalPosts = TESTING_MODE ? originalPosts.slice(0, 1) : originalPosts;
    for (const originalPost of originalPosts) {
      console.log(`Reformulating the post ${originalPost.title}..`);
      const reformulatedPost = await reformulatePost(
        blogSite,
        originalPost,
        openai
      );
      if (!reformulatedPost) continue;
      console.log(
        `Generating the post thumbnail for ${reformulatedPost.title}..`
      );
      const postThumbnailUrl = await generatePostThumbnail(
        reformulatedPost.title,
        openai
      );
      if (postThumbnailUrl) reformulatedPost.thumbnailUrl = postThumbnailUrl;
      if (!buffer[blogSite.id]) {
        buffer[blogSite.id] = [];
      }
      buffer[blogSite.id].push({
        original: originalPost,
        reformulated: reformulatedPost,
      });
      console.log(`Creating the post ${reformulatedPost.title} on Webflow..`);
      await createPostOnWebflow(originalPost.originalLink, reformulatedPost);
    }
  }
  if (Object.keys(buffer).length !== 0) {
    console.log("Writing new log file..");
    writeNewLogFile(buffer);
  }
}

init();
