function getFileType(mime) {
  if (mime.startsWith("image")) return "image";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("word")) return "word";
  if (mime.includes("excel")) return "excel";
  if (mime.includes("text")) return "text";
  return "other";
}

export { getFileType };