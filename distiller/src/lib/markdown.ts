import matter from 'gray-matter'
import type { EntityFile, EntityType } from '../types/entities'

/**
 * Parse a .md file string into frontmatter + body.
 */
export function parseMarkdown(raw: string): EntityFile {
  const { data, content } = matter(raw)
  return { frontmatter: data as Record<string, unknown>, body: content.trim() }
}

/**
 * Serialize frontmatter + body back into a .md string.
 */
export function serializeMarkdown(file: EntityFile): string {
  return matter.stringify(file.body, file.frontmatter as Record<string, unknown>)
}

/**
 * Convert an entity name to a kebab-case ASCII slug (max 60 chars).
 * For events, the caller should prepend the zero-padded timetrack prefix.
 */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')     // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')        // keep alphanumeric, spaces, hyphens
    .trim()
    .replace(/\s+/g, '-')                // spaces → hyphens
    .replace(/-+/g, '-')                 // collapse multiple hyphens
    .slice(0, 60)
}

/**
 * Build a slug for a specific entity type.
 * Events get a zero-padded timetrack prefix: "00003-name-of-event".
 */
export function buildSlug(name: string, entityType: EntityType, timetrack?: number): string {
  const base = slugify(name)
  if (entityType === 'events' && timetrack !== undefined) {
    return `${String(timetrack).padStart(5, '0')}-${base}`
  }
  return base
}

/**
 * Extract the Markdown section headings and their content from a body string.
 * Returns a map of section_name → content.
 */
export function parseSections(body: string): Map<string, string> {
  const sections = new Map<string, string>()
  const lines = body.split('\n')
  let currentSection: string | null = null
  const buffer: string[] = []

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+)$/)
    if (heading) {
      if (currentSection !== null) {
        sections.set(currentSection, buffer.join('\n').trim())
      }
      currentSection = heading[1].trim()
      buffer.length = 0
    } else if (currentSection !== null) {
      buffer.push(line)
    }
  }
  if (currentSection !== null) {
    sections.set(currentSection, buffer.join('\n').trim())
  }
  return sections
}

/**
 * Rebuild the body string from a sections map, preserving original order
 * and appending any new sections at the end.
 */
export function buildBody(sections: Map<string, string>): string {
  const parts: string[] = []
  for (const [heading, content] of sections.entries()) {
    parts.push(`## ${heading}`)
    if (content) parts.push(content)
    parts.push('')
  }
  return parts.join('\n').trim()
}

/**
 * Append content to a named section (## Heading) in a body string.
 * If the section does not exist, it is added at the end.
 */
export function appendToSection(body: string, sectionName: string, content: string): string {
  const sections = parseSections(body)
  const existing = sections.get(sectionName) ?? ''
  sections.set(sectionName, existing ? `${existing}\n${content}` : content)
  return buildBody(sections)
}

/**
 * Replace the content of a named section in a body string.
 * If the section does not exist, it is added at the end.
 */
export function replaceSection(body: string, sectionName: string, content: string): string {
  const sections = parseSections(body)
  sections.set(sectionName, content)
  return buildBody(sections)
}
