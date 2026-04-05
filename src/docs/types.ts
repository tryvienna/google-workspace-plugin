/**
 * Google Docs type definitions
 *
 * These types model the document structure used by Google Docs,
 * enabling 1:1 parity with the native format.
 */

/**
 * Text styling properties matching Google Docs capabilities
 */
export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  fontSize?: number; // in points (pt)
  fontFamily?: string;
  foregroundColor?: Color;
  backgroundColor?: Color;
  baselineOffset?: 'NONE' | 'SUPERSCRIPT' | 'SUBSCRIPT';
  smallCaps?: boolean;
  link?: Link;
}

export interface Color {
  red?: number; // 0-1
  green?: number; // 0-1
  blue?: number; // 0-1
}

export interface Link {
  url?: string;
  bookmarkId?: string;
  headingId?: string;
}

/**
 * Paragraph styling properties
 */
export interface ParagraphStyle {
  namedStyleType?: NamedStyleType;
  alignment?: Alignment;
  lineSpacing?: number; // percentage (100 = single, 200 = double)
  direction?: 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT';
  spacingMode?: 'NEVER_COLLAPSE' | 'COLLAPSE_LISTS';
  spaceAbove?: Dimension;
  spaceBelow?: Dimension;
  borderBetween?: ParagraphBorder;
  borderTop?: ParagraphBorder;
  borderBottom?: ParagraphBorder;
  borderLeft?: ParagraphBorder;
  borderRight?: ParagraphBorder;
  indentFirstLine?: Dimension;
  indentStart?: Dimension;
  indentEnd?: Dimension;
  tabStops?: TabStop[];
  keepLinesTogether?: boolean;
  keepWithNext?: boolean;
  avoidWidowAndOrphan?: boolean;
  shading?: Shading;
}

export type NamedStyleType =
  | 'NORMAL_TEXT'
  | 'TITLE'
  | 'SUBTITLE'
  | 'HEADING_1'
  | 'HEADING_2'
  | 'HEADING_3'
  | 'HEADING_4'
  | 'HEADING_5'
  | 'HEADING_6';

export type Alignment = 'START' | 'CENTER' | 'END' | 'JUSTIFIED';

export interface Dimension {
  magnitude: number;
  unit: 'PT' | 'MM' | 'INCH';
}

export interface ParagraphBorder {
  color?: Color;
  width?: Dimension;
  padding?: Dimension;
  dashStyle?: DashStyle;
}

export type DashStyle = 'SOLID' | 'DOT' | 'DASH' | 'DASH_DOT' | 'LONG_DASH' | 'LONG_DASH_DOT';

export interface TabStop {
  offset: Dimension;
  alignment: 'START' | 'CENTER' | 'END' | 'DECIMAL';
}

export interface Shading {
  backgroundColor?: Color;
}

/**
 * List properties for bulleted and numbered lists
 */
export interface ListProperties {
  nestingLevels: NestingLevel[];
}

export interface NestingLevel {
  bulletAlignment?: Alignment;
  glyphType?: GlyphType;
  glyphFormat?: string;
  indentFirstLine?: Dimension;
  indentStart?: Dimension;
  textStyle?: TextStyle;
  startNumber?: number;
}

export type GlyphType =
  | 'GLYPH_TYPE_UNSPECIFIED'
  | 'NONE'
  | 'DECIMAL'
  | 'ZERO_DECIMAL'
  | 'UPPER_ALPHA'
  | 'ALPHA'
  | 'UPPER_ROMAN'
  | 'ROMAN';

/**
 * Table structure
 */
export interface Table {
  rows: number;
  columns: number;
  tableRows: TableRow[];
  tableStyle?: TableStyle;
}

export interface TableRow {
  startIndex: number;
  endIndex: number;
  tableCells: TableCell[];
  tableRowStyle?: TableRowStyle;
}

export interface TableCell {
  startIndex: number;
  endIndex: number;
  content: StructuralElement[];
  tableCellStyle?: TableCellStyle;
}

export interface TableStyle {
  tableColumnProperties: TableColumnProperties[];
}

export interface TableColumnProperties {
  widthType: 'EVENLY_DISTRIBUTED' | 'FIXED_WIDTH';
  width?: Dimension;
}

export interface TableRowStyle {
  minRowHeight?: Dimension;
  tableHeader?: boolean;
  preventOverflow?: boolean;
}

export interface TableCellStyle {
  rowSpan?: number;
  columnSpan?: number;
  backgroundColor?: Color;
  borderLeft?: TableCellBorder;
  borderRight?: TableCellBorder;
  borderTop?: TableCellBorder;
  borderBottom?: TableCellBorder;
  paddingLeft?: Dimension;
  paddingRight?: Dimension;
  paddingTop?: Dimension;
  paddingBottom?: Dimension;
  contentAlignment?: 'TOP' | 'MIDDLE' | 'BOTTOM';
}

export interface TableCellBorder {
  color?: Color;
  width?: Dimension;
  dashStyle?: DashStyle;
}

/**
 * Inline objects (images, drawings, etc.)
 */
export interface InlineObject {
  objectId: string;
  inlineObjectProperties: InlineObjectProperties;
}

export interface InlineObjectProperties {
  embeddedObject: EmbeddedObject;
}

export interface EmbeddedObject {
  title?: string;
  description?: string;
  imageProperties?: ImageProperties;
  embeddedDrawingProperties?: EmbeddedDrawingProperties;
  size?: Size;
  marginTop?: Dimension;
  marginBottom?: Dimension;
  marginLeft?: Dimension;
  marginRight?: Dimension;
}

export interface ImageProperties {
  contentUri?: string;
  sourceUri?: string;
  brightness?: number;
  contrast?: number;
  transparency?: number;
  cropProperties?: CropProperties;
  angle?: number;
}

export interface CropProperties {
  offsetLeft?: number;
  offsetRight?: number;
  offsetTop?: number;
  offsetBottom?: number;
  angle?: number;
}

export interface EmbeddedDrawingProperties {
  // Drawing-specific properties
}

export interface Size {
  height: Dimension;
  width: Dimension;
}

/**
 * Document structure
 */
export interface Document {
  documentId: string;
  title: string;
  body: Body;
  documentStyle: DocumentStyle;
  namedStyles: NamedStyles;
  lists: Record<string, List>;
  inlineObjects: Record<string, InlineObject>;
  positionedObjects: Record<string, PositionedObject>;
  headers: Record<string, Header>;
  footers: Record<string, Footer>;
  footnotes: Record<string, Footnote>;
  suggestionsViewMode?: SuggestionsViewMode;
}

export interface Body {
  content: StructuralElement[];
}

export interface StructuralElement {
  startIndex: number;
  endIndex: number;
  paragraph?: Paragraph;
  sectionBreak?: SectionBreak;
  table?: Table;
  tableOfContents?: TableOfContents;
}

export interface Paragraph {
  elements: ParagraphElement[];
  paragraphStyle?: ParagraphStyle;
  bullet?: Bullet;
  positionedObjectIds?: string[];
}

export interface ParagraphElement {
  startIndex: number;
  endIndex: number;
  textRun?: TextRun;
  inlineObjectElement?: InlineObjectElement;
  pageBreak?: PageBreak;
  horizontalRule?: HorizontalRule;
  footnoteReference?: FootnoteReference;
  equation?: Equation;
  autoText?: AutoText;
  columnBreak?: ColumnBreak;
}

export interface TextRun {
  content: string;
  textStyle?: TextStyle;
}

export interface InlineObjectElement {
  inlineObjectId: string;
  textStyle?: TextStyle;
}

export interface PageBreak {
  textStyle?: TextStyle;
}

export interface HorizontalRule {
  textStyle?: TextStyle;
}

export interface FootnoteReference {
  footnoteId: string;
  footnoteNumber: string;
  textStyle?: TextStyle;
}

export interface Equation {
  // Equation content
}

export interface AutoText {
  type: 'PAGE_NUMBER' | 'PAGE_COUNT';
  textStyle?: TextStyle;
}

export interface ColumnBreak {
  textStyle?: TextStyle;
}

export interface Bullet {
  listId: string;
  nestingLevel: number;
  textStyle?: TextStyle;
}

export interface SectionBreak {
  sectionStyle?: SectionStyle;
}

export interface SectionStyle {
  columnSeparatorStyle?: 'NONE' | 'BETWEEN_EACH_COLUMN';
  contentDirection?: 'LEFT_TO_RIGHT' | 'RIGHT_TO_LEFT';
  marginTop?: Dimension;
  marginBottom?: Dimension;
  marginRight?: Dimension;
  marginLeft?: Dimension;
  marginHeader?: Dimension;
  marginFooter?: Dimension;
  sectionType?: 'CONTINUOUS' | 'NEXT_PAGE';
  defaultHeaderId?: string;
  defaultFooterId?: string;
  firstPageHeaderId?: string;
  firstPageFooterId?: string;
  evenPageHeaderId?: string;
  evenPageFooterId?: string;
  useFirstPageHeaderFooter?: boolean;
  pageNumberStart?: number;
  columnProperties?: SectionColumnProperties[];
}

export interface SectionColumnProperties {
  width?: Dimension;
  paddingEnd?: Dimension;
}

export interface TableOfContents {
  content: StructuralElement[];
}

export interface DocumentStyle {
  background?: Background;
  defaultHeaderId?: string;
  defaultFooterId?: string;
  evenPageHeaderId?: string;
  oddPageHeaderId?: string;
  evenPageFooterId?: string;
  oddPageFooterId?: string;
  firstPageHeaderId?: string;
  firstPageFooterId?: string;
  useFirstPageHeaderFooter?: boolean;
  useEvenPageHeaderFooter?: boolean;
  pageNumberStart?: number;
  marginTop?: Dimension;
  marginBottom?: Dimension;
  marginRight?: Dimension;
  marginLeft?: Dimension;
  pageSize?: Size;
  marginHeader?: Dimension;
  marginFooter?: Dimension;
  useCustomHeaderFooterMargins?: boolean;
}

export interface Background {
  color?: Color;
}

export interface NamedStyles {
  styles: NamedStyle[];
}

export interface NamedStyle {
  namedStyleType: NamedStyleType;
  textStyle: TextStyle;
  paragraphStyle: ParagraphStyle;
}

export interface List {
  listProperties: ListProperties;
}

export interface PositionedObject {
  objectId: string;
  positionedObjectProperties: PositionedObjectProperties;
}

export interface PositionedObjectProperties {
  positioning: PositionedObjectPositioning;
  embeddedObject: EmbeddedObject;
}

export interface PositionedObjectPositioning {
  layout: 'WRAP_TEXT' | 'BREAK_LEFT' | 'BREAK_RIGHT' | 'BREAK_LEFT_RIGHT' | 'IN_FRONT_OF_TEXT' | 'BEHIND_TEXT';
  leftOffset?: Dimension;
  topOffset?: Dimension;
}

export interface Header {
  headerId: string;
  content: StructuralElement[];
}

export interface Footer {
  footerId: string;
  content: StructuralElement[];
}

export interface Footnote {
  footnoteId: string;
  content: StructuralElement[];
}

export type SuggestionsViewMode = 'SUGGESTIONS_INLINE' | 'PREVIEW_SUGGESTIONS_ACCEPTED' | 'PREVIEW_WITHOUT_SUGGESTIONS';
