export function projectImagePath(pageId) {
  return `/api/project-image/${encodeURIComponent(pageId)}`;
}

export function getFirstNotionFileUrl(properties) {
  const imageFile =
    properties?.["Image (JPG, PNG, or GIF)"]?.files?.[0] ??
    properties?.Image?.files?.[0];

  return imageFile?.file?.url ?? imageFile?.external?.url ?? "";
}
