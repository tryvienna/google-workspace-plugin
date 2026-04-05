/**
 * Google Docs JSON to TipTap Converter
 *
 * Converts Google Docs API JSON format to TipTap/ProseMirror JSON format.
 */

import type { JSONContent } from '@tiptap/core';
import type {
  Document,
  Body,
  StructuralElement,
  ParagraphElement,
  TextRun,
  TextStyle,
  ParagraphStyle,
  Table,
  TableRow,
  TableCell,
  InlineObjectElement,
  Paragraph,
  NamedStyleType,
} from '../types';

import {
  type ConversionContext,
  type GoogleDocsToTipTapResult,
  type ConversionWarning,
  type DocumentStructure,
  type PreservedElement,
  type EditableRegion,
  colorToRgb,
  dimensionToPoints,
} from './types';

/**
 * Convert a Google Docs document to TipTap JSON format.
 *
 * @param document - The Google Docs document object from the API
 * @returns Conversion result with TipTap content and any warnings
 */
export function googleDocsToTipTap(document: Document): GoogleDocsToTipTapResult {
  const warnings: ConversionWarning[] = [];

  // Build conversion context
  const context: ConversionContext = {
    lists: {},
    inlineObjects: {},
    namedStyles: {} as Record<NamedStyleType, { textStyle: Partial<TextStyle>; paragraphStyle: Partial<ParagraphStyle> }>,
    documentId: document.documentId,
  };

  // Extract lists
  if (document.lists) {
    for (const [listId, list] of Object.entries(document.lists)) {
      context.lists[listId] = {
        listId,
        nestingLevels: list.listProperties.nestingLevels.map((level) => ({
          bulletAlignment: level.bulletAlignment,
          glyphType: level.glyphType,
          glyphFormat: level.glyphFormat,
          indentFirstLine: dimensionToPoints(level.indentFirstLine),
          indentStart: dimensionToPoints(level.indentStart),
          startNumber: level.startNumber,
        })),
      };
    }
  }

  // Extract inline objects
  if (document.inlineObjects) {
    for (const [objectId, inlineObject] of Object.entries(document.inlineObjects)) {
      const embedded = inlineObject.inlineObjectProperties.embeddedObject;
      context.inlineObjects[objectId] = {
        objectId,
        contentUri: embedded.imageProperties?.contentUri,
        sourceUri: embedded.imageProperties?.sourceUri,
        title: embedded.title,
        description: embedded.description,
        width: dimensionToPoints(embedded.size?.width),
        height: dimensionToPoints(embedded.size?.height),
      };
    }
  }

  // Extract named styles
  if (document.namedStyles) {
    for (const style of document.namedStyles.styles) {
      context.namedStyles[style.namedStyleType] = {
        textStyle: style.textStyle,
        paragraphStyle: style.paragraphStyle,
      };
    }
  }

  // Convert body content
  const content = convertBody(document.body, context, warnings);

  // Extract document structure for surgical updates
  const documentStructure = extractDocumentStructure(document.body, context);

  return {
    content: {
      type: 'doc' as const,
      content,
    },
    warnings,
    metadata: {
      documentId: document.documentId,
      title: document.title,
      convertedAt: new Date().toISOString(),
    },
    documentStructure,
  };
}

/**
 * Convert the document body to TipTap content
 */
function convertBody(
  body: Body,
  context: ConversionContext,
  warnings: ConversionWarning[]
): JSONContent[] {
  const content: JSONContent[] = [];

  for (const element of body.content) {
    const converted = convertStructuralElement(element, context, warnings);
    if (converted) {
      if (Array.isArray(converted)) {
        content.push(...converted);
      } else {
        content.push(converted);
      }
    }
  }

  // Merge consecutive lists of the same type
  return mergeConsecutiveLists(content);
}

/**
 * Merge consecutive lists and properly nest sub-items.
 * Google Docs stores each list item as a separate paragraph with a bullet and nesting level.
 * TipTap expects nested lists to be actual nested DOM structure.
 */
function mergeConsecutiveLists(content: JSONContent[]): JSONContent[] {
  const result: JSONContent[] = [];

  for (const node of content) {
    const lastNode = result[result.length - 1];

    // Check if this is a list
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      const nodeNestingLevel = node.attrs?.nestingLevel || 0;
      const nodeListId = node.attrs?.listId;

      // Check if we can merge with the previous list
      if (
        lastNode &&
        (lastNode.type === 'bulletList' || lastNode.type === 'orderedList') &&
        nodeListId === lastNode.attrs?.listId
      ) {
        // Same listId - need to handle nesting
        if (nodeNestingLevel === 0) {
          // Top-level item - merge directly
          if (node.content && lastNode.content) {
            lastNode.content.push(...node.content);
          }
        } else {
          // Nested item - find the correct parent and nest it
          nestListItem(lastNode, node, nodeNestingLevel);
        }
      } else {
        // Different list or not a list - just add it
        // But first, clean up the nestingLevel attr (TipTap doesn't need it)
        const cleanNode = { ...node };
        if (cleanNode.attrs) {
          const { nestingLevel, ...restAttrs } = cleanNode.attrs;
          cleanNode.attrs = Object.keys(restAttrs).length > 0 ? restAttrs : undefined;
        }
        result.push(cleanNode);
      }
    } else {
      result.push(node);
    }
  }

  return result;
}

/**
 * Nest a list item at the correct depth within an existing list.
 */
function nestListItem(parentList: JSONContent, itemToNest: JSONContent, targetLevel: number): void {
  if (!parentList.content || parentList.content.length === 0) return;

  // Get the last list item in the parent
  const lastItem = parentList.content[parentList.content.length - 1];
  if (lastItem.type !== 'listItem') return;

  // If target level is 1, nest directly under last item
  if (targetLevel === 1) {
    // Check if there's already a nested list
    const existingNestedList = lastItem.content?.find(
      (c: JSONContent) => c.type === 'bulletList' || c.type === 'orderedList'
    );

    if (existingNestedList && existingNestedList.content) {
      // Add to existing nested list
      if (itemToNest.content) {
        existingNestedList.content.push(...itemToNest.content);
      }
    } else {
      // Create new nested list
      if (!lastItem.content) lastItem.content = [];
      const nestedList: JSONContent = {
        type: itemToNest.type,
        content: itemToNest.content,
      };
      lastItem.content.push(nestedList);
    }
  } else {
    // Need to go deeper - find or create nested list and recurse
    let nestedList = lastItem.content?.find(
      (c: JSONContent) => c.type === 'bulletList' || c.type === 'orderedList'
    );

    if (!nestedList) {
      // Create intermediate nested list
      nestedList = {
        type: itemToNest.type,
        content: [{ type: 'listItem', content: [{ type: 'paragraph' }] }],
      };
      if (!lastItem.content) lastItem.content = [];
      lastItem.content.push(nestedList);
    }

    nestListItem(nestedList, itemToNest, targetLevel - 1);
  }
}

/**
 * Convert a structural element (paragraph, table, section break, etc.)
 */
function convertStructuralElement(
  element: StructuralElement,
  context: ConversionContext,
  warnings: ConversionWarning[]
): JSONContent | JSONContent[] | null {
  if (element.paragraph) {
    return convertParagraph(element.paragraph, context, warnings);
  }

  if (element.table) {
    return convertTable(element.table, context, warnings);
  }

  if (element.sectionBreak) {
    return {
      type: 'sectionBreak',
      attrs: {
        sectionType: element.sectionBreak.sectionStyle?.sectionType || 'NEXT_PAGE',
      },
    };
  }

  if (element.tableOfContents) {
    warnings.push({
      type: 'unsupported_feature',
      message: 'Table of contents is not yet supported',
    });
    return null;
  }

  return null;
}

/**
 * Convert a paragraph element
 */
function convertParagraph(
  paragraph: Paragraph,
  context: ConversionContext,
  warnings: ConversionWarning[]
): JSONContent | JSONContent[] {
  const { elements, paragraphStyle, bullet } = paragraph;

  // Check if this is a list item
  if (bullet) {
    return convertListItem(paragraph, context, warnings);
  }

  // Check if this is a heading
  const namedStyle = paragraphStyle?.namedStyleType;
  if (namedStyle && namedStyle.startsWith('HEADING_')) {
    const level = parseInt(namedStyle.replace('HEADING_', ''), 10);
    return {
      type: 'heading',
      attrs: {
        level,
        ...extractParagraphAttrs(paragraphStyle),
      },
      content: convertParagraphElements(elements, context, warnings),
    };
  }

  // Regular paragraph
  return {
    type: 'paragraph',
    attrs: {
      namedStyleType: namedStyle || 'NORMAL_TEXT',
      ...extractParagraphAttrs(paragraphStyle),
    },
    content: convertParagraphElements(elements, context, warnings),
  };
}

/**
 * Extract paragraph attributes for TipTap
 */
function extractParagraphAttrs(style: ParagraphStyle | undefined): Record<string, unknown> {
  if (!style) return {};

  const attrs: Record<string, unknown> = {};

  // Text alignment
  if (style.alignment) {
    const alignmentMap: Record<string, string> = {
      START: 'left',
      CENTER: 'center',
      END: 'right',
      JUSTIFIED: 'justify',
    };
    attrs.textAlign = alignmentMap[style.alignment] || 'left';
  }

  // Line spacing (convert percentage)
  if (style.lineSpacing) {
    attrs.lineSpacing = style.lineSpacing;
  }

  // Spacing above/below
  if (style.spaceAbove) {
    attrs.spaceAbove = dimensionToPoints(style.spaceAbove);
  }
  if (style.spaceBelow) {
    attrs.spaceBelow = dimensionToPoints(style.spaceBelow);
  }

  // Indentation
  if (style.indentStart) {
    attrs.indentStart = dimensionToPoints(style.indentStart);
  }
  if (style.indentEnd) {
    attrs.indentEnd = dimensionToPoints(style.indentEnd);
  }
  if (style.indentFirstLine) {
    attrs.indentFirstLine = dimensionToPoints(style.indentFirstLine);
  }

  return attrs;
}

/**
 * Convert a list item
 */
function convertListItem(
  paragraph: Paragraph,
  context: ConversionContext,
  warnings: ConversionWarning[]
): JSONContent[] {
  const { bullet, elements } = paragraph;
  if (!bullet) return [];

  const listInfo = context.lists[bullet.listId];
  const nestingLevel = bullet.nestingLevel || 0;
  const levelInfo = listInfo?.nestingLevels[nestingLevel];

  // Determine list type based on glyph type
  const isOrdered = levelInfo?.glyphType &&
    ['DECIMAL', 'ZERO_DECIMAL', 'UPPER_ALPHA', 'ALPHA', 'UPPER_ROMAN', 'ROMAN'].includes(levelInfo.glyphType);

  const listType = isOrdered ? 'orderedList' : 'bulletList';

  // Create the list item content
  const listItemContent: JSONContent = {
    type: 'listItem',
    content: [
      {
        type: 'paragraph',
        content: convertParagraphElements(elements, context, warnings),
      },
    ],
  };

  // Wrap in list
  return [
    {
      type: listType,
      attrs: {
        listId: bullet.listId,
        nestingLevel,
      },
      content: [listItemContent],
    },
  ];
}

/**
 * Convert paragraph elements (text runs, inline objects, etc.)
 */
function convertParagraphElements(
  elements: ParagraphElement[] | undefined,
  context: ConversionContext,
  warnings: ConversionWarning[]
): JSONContent[] {
  if (!elements) return [];

  const content: JSONContent[] = [];

  for (const element of elements) {
    if (element.textRun) {
      const textContent = convertTextRun(element.textRun, warnings);
      if (textContent) {
        content.push(textContent);
      }
    } else if (element.inlineObjectElement) {
      const inlineContent = convertInlineObject(element.inlineObjectElement, context, warnings);
      if (inlineContent) {
        content.push(inlineContent);
      }
    } else if (element.pageBreak) {
      content.push({ type: 'pageBreak' });
    } else if (element.horizontalRule) {
      content.push({ type: 'horizontalRule' });
    } else if (element.footnoteReference) {
      warnings.push({
        type: 'unsupported_feature',
        message: 'Footnotes are not yet supported',
      });
    }
  }

  return content;
}

/**
 * Convert a text run to TipTap text node with marks
 */
function convertTextRun(textRun: TextRun, warnings: ConversionWarning[]): JSONContent | null {
  const { content, textStyle } = textRun;

  // Skip empty content or just newlines at end of paragraphs
  if (!content || content === '\n') {
    return null;
  }

  // Remove trailing newline (TipTap handles this differently)
  const text = content.replace(/\n$/, '');
  if (!text) return null;

  const marks = extractTextMarks(textStyle, warnings);

  return {
    type: 'text',
    text,
    marks: marks && marks.length > 0 ? marks : undefined,
  };
}

/**
 * Extract TipTap marks from Google Docs text style
 */
function extractTextMarks(
  style: TextStyle | undefined,
  warnings: ConversionWarning[]
): JSONContent['marks'] {
  if (!style) return [];

  const marks: JSONContent['marks'] = [];

  if (style.bold) {
    marks.push({ type: 'bold' });
  }

  if (style.italic) {
    marks.push({ type: 'italic' });
  }

  if (style.underline) {
    marks.push({ type: 'underline' });
  }

  if (style.strikethrough) {
    marks.push({ type: 'strike' });
  }

  if (style.baselineOffset === 'SUBSCRIPT') {
    marks.push({ type: 'subscript' });
  } else if (style.baselineOffset === 'SUPERSCRIPT') {
    marks.push({ type: 'superscript' });
  }

  if (style.fontFamily) {
    marks.push({
      type: 'textStyle',
      attrs: { fontFamily: style.fontFamily },
    });
  }

  if (style.fontSize) {
    marks.push({
      type: 'textStyle',
      attrs: { fontSize: `${style.fontSize}pt` },
    });
  }

  if (style.foregroundColor) {
    const color = colorToRgb(style.foregroundColor);
    if (color) {
      marks.push({
        type: 'textStyle',
        attrs: { color },
      });
    }
  }

  if (style.backgroundColor) {
    const color = colorToRgb(style.backgroundColor);
    if (color) {
      marks.push({
        type: 'highlight',
        attrs: { color },
      });
    }
  }

  if (style.link?.url) {
    marks.push({
      type: 'link',
      attrs: { href: style.link.url },
    });
  }

  if (style.smallCaps) {
    warnings.push({
      type: 'approximation',
      message: 'Small caps approximated with CSS font-variant',
    });
    marks.push({
      type: 'textStyle',
      attrs: { fontVariant: 'small-caps' },
    });
  }

  return marks;
}

/**
 * Convert an inline object (image, drawing, etc.)
 */
function convertInlineObject(
  inlineElement: InlineObjectElement,
  context: ConversionContext,
  warnings: ConversionWarning[]
): JSONContent | null {
  const objectId = inlineElement.inlineObjectId;
  const objectInfo = context.inlineObjects[objectId];

  if (!objectInfo) {
    warnings.push({
      type: 'data_loss',
      message: `Inline object ${objectId} not found in document`,
    });
    return null;
  }

  const imgSrc = objectInfo.contentUri || objectInfo.sourceUri;

  return {
    type: 'image',
    attrs: {
      src: imgSrc,
      alt: objectInfo.title || objectInfo.description || '',
      title: objectInfo.title || '',
    },
  };
}

/**
 * Convert a table
 */
function convertTable(
  table: Table,
  context: ConversionContext,
  warnings: ConversionWarning[]
): JSONContent {
  const rows = table.tableRows.map((row) => convertTableRow(row, context, warnings));

  return {
    type: 'table',
    content: rows,
  };
}

/**
 * Convert a table row
 */
function convertTableRow(
  row: TableRow,
  context: ConversionContext,
  warnings: ConversionWarning[]
): JSONContent {
  const cells = row.tableCells.map((cell) => convertTableCell(cell, context, warnings));

  return {
    type: 'tableRow',
    content: cells,
  };
}

/**
 * Convert a table cell
 */
function convertTableCell(
  cell: TableCell,
  context: ConversionContext,
  warnings: ConversionWarning[]
): JSONContent {
  const cellStyle = cell.tableCellStyle;

  // Convert cell content (which contains structural elements)
  const content: JSONContent[] = [];
  for (const element of cell.content) {
    const converted = convertStructuralElement(element, context, warnings);
    if (converted) {
      if (Array.isArray(converted)) {
        content.push(...converted);
      } else {
        content.push(converted);
      }
    }
  }

  // Ensure there's at least one paragraph
  if (content.length === 0) {
    content.push({ type: 'paragraph' });
  }

  const attrs: Record<string, unknown> = {};

  // Handle cell spanning
  if (cellStyle?.rowSpan && cellStyle.rowSpan > 1) {
    attrs.rowspan = cellStyle.rowSpan;
  }
  if (cellStyle?.columnSpan && cellStyle.columnSpan > 1) {
    attrs.colspan = cellStyle.columnSpan;
  }

  // Background color
  if (cellStyle?.backgroundColor) {
    attrs.backgroundColor = colorToRgb(cellStyle.backgroundColor);
  }

  return {
    type: 'tableCell',
    attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
    content,
  };
}

/**
 * Extract document structure for surgical updates.
 * Identifies preserved elements (images, tables) and editable text regions.
 */
function extractDocumentStructure(body: Body, _context: ConversionContext): DocumentStructure {
  const preservedElements: PreservedElement[] = [];
  const editableRegions: EditableRegion[] = [];
  let endIndex = 1;
  let hasComplexContent = false;

  let currentRegionStart = 1;
  let currentRegionText = '';

  for (const element of body.content) {
    const startIdx = element.startIndex || 0;
    const endIdx = element.endIndex || 0;
    endIndex = Math.max(endIndex, endIdx);

    if (element.table) {
      hasComplexContent = true;

      if (currentRegionText.length > 0 || currentRegionStart < startIdx) {
        editableRegions.push({
          startIndex: currentRegionStart,
          endIndex: startIdx,
          originalText: currentRegionText,
        });
      }

      preservedElements.push({
        type: 'table',
        startIndex: startIdx,
        endIndex: endIdx,
      });

      currentRegionStart = endIdx;
      currentRegionText = '';
    } else if (element.paragraph) {
      for (const el of element.paragraph.elements || []) {
        if (el.inlineObjectElement) {
          hasComplexContent = true;
          const inlineStart = el.startIndex || 0;
          const inlineEnd = el.endIndex || 0;

          if (currentRegionText.length > 0 || currentRegionStart < inlineStart) {
            editableRegions.push({
              startIndex: currentRegionStart,
              endIndex: inlineStart,
              originalText: currentRegionText,
            });
          }

          preservedElements.push({
            type: 'image',
            startIndex: inlineStart,
            endIndex: inlineEnd,
            objectId: el.inlineObjectElement.inlineObjectId,
          });

          currentRegionStart = inlineEnd;
          currentRegionText = '';
        } else if (el.textRun) {
          currentRegionText += el.textRun.content || '';
        }
      }
    }
  }

  // Close final editable region
  if (currentRegionStart < endIndex) {
    editableRegions.push({
      startIndex: currentRegionStart,
      endIndex: endIndex,
      originalText: currentRegionText,
    });
  }

  return {
    preservedElements,
    editableRegions,
    endIndex,
    hasComplexContent,
  };
}

export default googleDocsToTipTap;
