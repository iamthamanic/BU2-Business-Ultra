/**
 * Shared notes primitives. Prefer named imports from this folder.
 * Location: apps/web/src/components/notes/index.ts
 */
export { NoteCard } from './NoteCard'
export { NoteComposerModal } from './NoteComposerModal'
export {
  NoteBodyHtml,
  NoteEditor,
  CustomerNoteEditor,
  notePlainText,
  sanitizeNoteHtml,
} from './NoteEditor'
export { NoteThread } from './NoteThread'
export { ThreadedNotesList, type NoteThreadGroup } from './ThreadedNotesList'
export type { ThreadNote } from './noteUtils'
export { useNoteComposer } from './useNoteComposer'
