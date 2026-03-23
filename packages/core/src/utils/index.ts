export function isEmptyStringOrNil(value: unknown): value is null | undefined | '' {
  return value === null || value === undefined || value === ''
}

export * from './frontmatter.js'
