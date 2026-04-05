/**
 * Converter Types
 *
 * Type definitions for the conversion between Google Docs and TipTap formats.
 */

import type { JSONContent } from '@tiptap/core';
import type {
  Document,
  TextStyle,
  ParagraphStyle,
  Color,
  NamedStyleType,
} from '../types';

/**
 * TipTap JSON document format
 */
export type TipTapDocument = JSONContent;

/**
 * Context passed during conversion
 */
export interface ConversionContext {
  /** Map of list IDs to their properties */
  lists: Record<string, ListContext>;
  /** Map of inline object IDs to their data */
  inlineObjects: Record<string, InlineObjectContext>;
  /** Named styles defined in the document */
  namedStyles: Record<NamedStyleType, NamedStyleContext>;
  /** Current document ID */
  documentId?: string;
}

export interface ListContext {
  listId: string;
  nestingLevels: NestingLevelContext[];
}

export interface NestingLevelContext {
  bulletAlignment?: string;
  glyphType?: string;
  glyphFormat?: string;
  indentFirstLine?: number;
  indentStart?: number;
  startNumber?: number;
}

export interface InlineObjectContext {
  objectId: string;
  contentUri?: string;
  sourceUri?: string;
  title?: string;
  description?: string;
  width?: number;
  height?: number;
}

export interface NamedStyleContext {
  textStyle: Partial<TextStyle>;
  paragraphStyle: Partial<ParagraphStyle>;
}

/**
 * Represents a preserved element (image, table) that should not be modified during save
 */
export interface PreservedElement {
  type: 'image' | 'table';
  startIndex: number;
  endIndex: number;
  objectId?: string;
}

/**
 * Represents an editable text region between preserved elements
 */
export interface EditableRegion {
  startIndex: number;
  endIndex: number;
  originalText: string;
}

/**
 * Original document structure used for surgical updates
 */
export interface DocumentStructure {
  /** Preserved elements that should not be modified */
  preservedElements: PreservedElement[];
  /** Text regions that can be edited */
  editableRegions: EditableRegion[];
  /** Total document length */
  endIndex: number;
  /** Whether document has complex elements */
  hasComplexContent: boolean;
}

/**
 * Result of converting a Google Docs document to TipTap
 */
export interface GoogleDocsToTipTapResult {
  /** The TipTap JSON content */
  content: TipTapDocument;
  /** Any warnings or issues encountered during conversion */
  warnings: ConversionWarning[];
  /** Metadata about the conversion */
  metadata: {
    documentId: string;
    title: string;
    convertedAt: string;
  };
  /** Document structure for surgical updates */
  documentStructure: DocumentStructure;
}

/**
 * Warning generated during conversion
 */
export interface ConversionWarning {
  type: 'unsupported_feature' | 'data_loss' | 'approximation';
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

/**
 * Converts a Google Docs Color to CSS color string
 */
export function colorToRgb(color: Color | undefined): string | undefined {
  if (!color) return undefined;
  const r = Math.round((color.red ?? 0) * 255);
  const g = Math.round((color.green ?? 0) * 255);
  const b = Math.round((color.blue ?? 0) * 255);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Converts Google Docs dimension to points
 */
export function dimensionToPoints(dimension: { magnitude: number; unit: string } | undefined): number | undefined {
  if (!dimension) return undefined;

  switch (dimension.unit) {
    case 'PT':
      return dimension.magnitude;
    case 'MM':
      return dimension.magnitude * 2.83465; // mm to pt
    case 'INCH':
      return dimension.magnitude * 72; // inches to pt
    default:
      return dimension.magnitude;
  }
}
