import pdf from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import { AppError } from "../utils/AppError.js";

export const SUPPORTED_TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/** Extract plain text from an uploaded PDF or DOCX buffer. */
export async function extractResumeText(buffer, mimetype) {
  const kind = SUPPORTED_TYPES[mimetype];
  if (!kind) throw new AppError(400, "Only PDF and DOCX resumes are supported");

  let text = "";
  try {
    if (kind === "pdf") {
      const data = await pdf(buffer);
      text = data.text;
    } else {
      const { value } = await mammoth.extractRawText({ buffer });
      text = value;
    }
  } catch {
    throw new AppError(422, "Could not read the file. Make sure it is a valid, unencrypted PDF or DOCX.");
  }

  text = cleanText(text);

  // A scanned (image-only) PDF has no text layer. ATS systems can't read it either.
  if (text.split(/\s+/).length < 50) {
    throw new AppError(
      422,
      "Very little text was found. The resume is probably a scanned image, which ATS software cannot read either. Export it as a text-based PDF."
    );
  }
  return text;
}

export function cleanText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
