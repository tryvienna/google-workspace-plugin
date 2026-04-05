/**
 * Unit tests for the Google Docs to TipTap converter.
 *
 * Tests conversion of various document structures: paragraphs, headings,
 * lists, tables, images, text formatting, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import { googleDocsToTipTap } from '../docs/converters/googleDocsToTipTap';
import { colorToRgb, dimensionToPoints } from '../docs/converters/types';
import type { Document, StructuralElement, Paragraph, TextRun, ParagraphElement } from '../docs/types';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeDoc(content: StructuralElement[], opts: Partial<Document> = {}): Document {
  return {
    documentId: 'test-doc',
    title: 'Test Document',
    body: { content },
    documentStyle: {},
    namedStyles: { styles: [] },
    lists: {},
    inlineObjects: {},
    positionedObjects: {},
    headers: {},
    footers: {},
    footnotes: {},
    ...opts,
  } as Document;
}

function textElement(content: string, textStyle?: TextRun['textStyle']): ParagraphElement {
  return {
    startIndex: 0,
    endIndex: content.length,
    textRun: { content, textStyle },
  };
}

function paragraphEl(elements: ParagraphElement[], style?: Paragraph['paragraphStyle']): StructuralElement {
  return {
    startIndex: 0,
    endIndex: 100,
    paragraph: { elements, paragraphStyle: style },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility functions
// ─────────────────────────────────────────────────────────────────────────────

describe('colorToRgb', () => {
  it('converts Google Docs color to CSS rgb string', () => {
    expect(colorToRgb({ red: 1, green: 0, blue: 0 })).toBe('rgb(255, 0, 0)');
    expect(colorToRgb({ red: 0, green: 0.5, blue: 1 })).toBe('rgb(0, 128, 255)');
  });

  it('returns undefined for undefined input', () => {
    expect(colorToRgb(undefined)).toBeUndefined();
  });

  it('treats missing color channels as 0', () => {
    expect(colorToRgb({})).toBe('rgb(0, 0, 0)');
    expect(colorToRgb({ red: 1 })).toBe('rgb(255, 0, 0)');
  });
});

describe('dimensionToPoints', () => {
  it('converts PT to points (identity)', () => {
    expect(dimensionToPoints({ magnitude: 12, unit: 'PT' })).toBe(12);
  });

  it('converts MM to points', () => {
    const result = dimensionToPoints({ magnitude: 1, unit: 'MM' });
    expect(result).toBeCloseTo(2.835, 2);
  });

  it('converts INCH to points', () => {
    expect(dimensionToPoints({ magnitude: 1, unit: 'INCH' })).toBe(72);
  });

  it('returns undefined for undefined input', () => {
    expect(dimensionToPoints(undefined)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Basic conversion
// ─────────────────────────────────────────────────────────────────────────────

describe('googleDocsToTipTap', () => {
  it('converts a simple paragraph', () => {
    const doc = makeDoc([
      paragraphEl([textElement('Hello world\n')]),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.content.type).toBe('doc');
    expect(result.content.content).toHaveLength(1);
    expect(result.content.content![0].type).toBe('paragraph');
    expect(result.content.content![0].content![0].text).toBe('Hello world');
  });

  it('returns metadata', () => {
    const doc = makeDoc([], { documentId: 'doc-123', title: 'My Doc' });
    const result = googleDocsToTipTap(doc);
    expect(result.metadata.documentId).toBe('doc-123');
    expect(result.metadata.title).toBe('My Doc');
    expect(result.metadata.convertedAt).toBeDefined();
  });

  it('skips empty text runs and newline-only runs', () => {
    const doc = makeDoc([
      paragraphEl([
        textElement(''),
        textElement('\n'),
        textElement('visible\n'),
      ]),
    ]);

    const result = googleDocsToTipTap(doc);
    const para = result.content.content![0];
    expect(para.content).toHaveLength(1);
    expect(para.content![0].text).toBe('visible');
  });

  it('strips trailing newlines from text runs', () => {
    const doc = makeDoc([
      paragraphEl([textElement('Some text\n')]),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.content.content![0].content![0].text).toBe('Some text');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Headings
// ─────────────────────────────────────────────────────────────────────────────

describe('headings', () => {
  it('converts HEADING_1 to heading level 1', () => {
    const doc = makeDoc([
      paragraphEl(
        [textElement('Title\n')],
        { namedStyleType: 'HEADING_1' },
      ),
    ]);

    const result = googleDocsToTipTap(doc);
    const heading = result.content.content![0];
    expect(heading.type).toBe('heading');
    expect(heading.attrs?.level).toBe(1);
  });

  it('converts HEADING_3 to heading level 3', () => {
    const doc = makeDoc([
      paragraphEl(
        [textElement('Sub-heading\n')],
        { namedStyleType: 'HEADING_3' },
      ),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.content.content![0].attrs?.level).toBe(3);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Text formatting / marks
// ─────────────────────────────────────────────────────────────────────────────

describe('text formatting marks', () => {
  it('applies bold mark', () => {
    const doc = makeDoc([
      paragraphEl([textElement('bold text\n', { bold: true })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'bold' });
  });

  it('applies italic mark', () => {
    const doc = makeDoc([
      paragraphEl([textElement('italic\n', { italic: true })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'italic' });
  });

  it('applies underline mark', () => {
    const doc = makeDoc([
      paragraphEl([textElement('underlined\n', { underline: true })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'underline' });
  });

  it('applies strikethrough mark', () => {
    const doc = makeDoc([
      paragraphEl([textElement('struck\n', { strikethrough: true })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'strike' });
  });

  it('applies subscript mark', () => {
    const doc = makeDoc([
      paragraphEl([textElement('H2O\n', { baselineOffset: 'SUBSCRIPT' })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'subscript' });
  });

  it('applies superscript mark', () => {
    const doc = makeDoc([
      paragraphEl([textElement('x²\n', { baselineOffset: 'SUPERSCRIPT' })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'superscript' });
  });

  it('applies font family via textStyle mark', () => {
    const doc = makeDoc([
      paragraphEl([textElement('serif\n', { fontFamily: 'Times New Roman' })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'textStyle', attrs: { fontFamily: 'Times New Roman' } });
  });

  it('applies font size via textStyle mark', () => {
    const doc = makeDoc([
      paragraphEl([textElement('big\n', { fontSize: 24 })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'textStyle', attrs: { fontSize: '24pt' } });
  });

  it('applies foreground color via textStyle mark', () => {
    const doc = makeDoc([
      paragraphEl([textElement('red\n', { foregroundColor: { red: 1, green: 0, blue: 0 } })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'textStyle', attrs: { color: 'rgb(255, 0, 0)' } });
  });

  it('applies background color via highlight mark', () => {
    const doc = makeDoc([
      paragraphEl([textElement('highlighted\n', { backgroundColor: { red: 1, green: 1, blue: 0 } })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'highlight', attrs: { color: 'rgb(255, 255, 0)' } });
  });

  it('applies link mark', () => {
    const doc = makeDoc([
      paragraphEl([textElement('click here\n', { link: { url: 'https://example.com' } })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'link', attrs: { href: 'https://example.com' } });
  });

  it('applies multiple marks to the same text run', () => {
    const doc = makeDoc([
      paragraphEl([textElement('bold italic\n', { bold: true, italic: true, underline: true })]),
    ]);

    const result = googleDocsToTipTap(doc);
    const marks = result.content.content![0].content![0].marks!;
    expect(marks).toHaveLength(3);
    expect(marks.map((m: any) => m.type)).toContain('bold');
    expect(marks.map((m: any) => m.type)).toContain('italic');
    expect(marks.map((m: any) => m.type)).toContain('underline');
  });

  it('omits marks array when no styles are applied', () => {
    const doc = makeDoc([
      paragraphEl([textElement('plain text\n')]),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.content.content![0].content![0].marks).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Paragraph attributes
// ─────────────────────────────────────────────────────────────────────────────

describe('paragraph attributes', () => {
  it('converts alignment', () => {
    const doc = makeDoc([
      paragraphEl([textElement('centered\n')], { alignment: 'CENTER' }),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.content.content![0].attrs?.textAlign).toBe('center');
  });

  it('converts line spacing', () => {
    const doc = makeDoc([
      paragraphEl([textElement('spaced\n')], { lineSpacing: 200 }),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.content.content![0].attrs?.lineSpacing).toBe(200);
  });

  it('converts indentation', () => {
    const doc = makeDoc([
      paragraphEl([textElement('indented\n')], {
        indentStart: { magnitude: 36, unit: 'PT' },
        indentFirstLine: { magnitude: 18, unit: 'PT' },
      }),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.content.content![0].attrs?.indentStart).toBe(36);
    expect(result.content.content![0].attrs?.indentFirstLine).toBe(18);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Lists
// ─────────────────────────────────────────────────────────────────────────────

describe('lists', () => {
  it('converts a bullet list', () => {
    const doc = makeDoc(
      [
        {
          startIndex: 0,
          endIndex: 10,
          paragraph: {
            elements: [textElement('Item 1\n')],
            bullet: { listId: 'list1', nestingLevel: 0 },
          },
        },
        {
          startIndex: 10,
          endIndex: 20,
          paragraph: {
            elements: [textElement('Item 2\n')],
            bullet: { listId: 'list1', nestingLevel: 0 },
          },
        },
      ],
      {
        lists: {
          list1: {
            listProperties: {
              nestingLevels: [{ glyphType: 'GLYPH_TYPE_UNSPECIFIED' }],
            },
          },
        },
      },
    );

    const result = googleDocsToTipTap(doc);
    // Should be merged into a single bulletList
    expect(result.content.content).toHaveLength(1);
    const list = result.content.content![0];
    expect(list.type).toBe('bulletList');
    expect(list.content).toHaveLength(2);
  });

  it('converts an ordered list based on glyph type', () => {
    const doc = makeDoc(
      [
        {
          startIndex: 0,
          endIndex: 10,
          paragraph: {
            elements: [textElement('First\n')],
            bullet: { listId: 'list2', nestingLevel: 0 },
          },
        },
      ],
      {
        lists: {
          list2: {
            listProperties: {
              nestingLevels: [{ glyphType: 'DECIMAL' }],
            },
          },
        },
      },
    );

    const result = googleDocsToTipTap(doc);
    expect(result.content.content![0].type).toBe('orderedList');
  });

  it('nests sub-items under parent list items', () => {
    const doc = makeDoc(
      [
        {
          startIndex: 0,
          endIndex: 10,
          paragraph: {
            elements: [textElement('Parent\n')],
            bullet: { listId: 'list3', nestingLevel: 0 },
          },
        },
        {
          startIndex: 10,
          endIndex: 20,
          paragraph: {
            elements: [textElement('Child\n')],
            bullet: { listId: 'list3', nestingLevel: 1 },
          },
        },
      ],
      {
        lists: {
          list3: {
            listProperties: {
              nestingLevels: [
                { glyphType: 'GLYPH_TYPE_UNSPECIFIED' },
                { glyphType: 'GLYPH_TYPE_UNSPECIFIED' },
              ],
            },
          },
        },
      },
    );

    const result = googleDocsToTipTap(doc);
    const list = result.content.content![0];
    expect(list.type).toBe('bulletList');
    // The first listItem should have a nested list inside it
    const firstItem = list.content![0];
    expect(firstItem.type).toBe('listItem');
    const nestedList = firstItem.content?.find((c: any) => c.type === 'bulletList');
    expect(nestedList).toBeDefined();
    expect(nestedList!.content![0].type).toBe('listItem');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Tables
// ─────────────────────────────────────────────────────────────────────────────

describe('tables', () => {
  it('converts a simple table', () => {
    const doc = makeDoc([
      {
        startIndex: 0,
        endIndex: 100,
        table: {
          rows: 2,
          columns: 2,
          tableRows: [
            {
              startIndex: 1,
              endIndex: 50,
              tableCells: [
                {
                  startIndex: 2,
                  endIndex: 25,
                  content: [paragraphEl([textElement('A1\n')])],
                },
                {
                  startIndex: 25,
                  endIndex: 49,
                  content: [paragraphEl([textElement('B1\n')])],
                },
              ],
            },
            {
              startIndex: 50,
              endIndex: 99,
              tableCells: [
                {
                  startIndex: 51,
                  endIndex: 75,
                  content: [paragraphEl([textElement('A2\n')])],
                },
                {
                  startIndex: 75,
                  endIndex: 98,
                  content: [paragraphEl([textElement('B2\n')])],
                },
              ],
            },
          ],
        },
      },
    ]);

    const result = googleDocsToTipTap(doc);
    const table = result.content.content![0];
    expect(table.type).toBe('table');
    expect(table.content).toHaveLength(2); // 2 rows
    expect(table.content![0].type).toBe('tableRow');
    expect(table.content![0].content).toHaveLength(2); // 2 cells
    expect(table.content![0].content![0].type).toBe('tableCell');
  });

  it('preserves cell spanning attributes', () => {
    const doc = makeDoc([
      {
        startIndex: 0,
        endIndex: 100,
        table: {
          rows: 1,
          columns: 2,
          tableRows: [
            {
              startIndex: 1,
              endIndex: 99,
              tableCells: [
                {
                  startIndex: 2,
                  endIndex: 50,
                  content: [paragraphEl([textElement('Spanning\n')])],
                  tableCellStyle: { columnSpan: 2 },
                },
              ],
            },
          ],
        },
      },
    ]);

    const result = googleDocsToTipTap(doc);
    const cell = result.content.content![0].content![0].content![0];
    expect(cell.attrs?.colspan).toBe(2);
  });

  it('adds empty paragraph to empty cells', () => {
    const doc = makeDoc([
      {
        startIndex: 0,
        endIndex: 50,
        table: {
          rows: 1,
          columns: 1,
          tableRows: [
            {
              startIndex: 1,
              endIndex: 49,
              tableCells: [
                {
                  startIndex: 2,
                  endIndex: 3,
                  content: [],
                },
              ],
            },
          ],
        },
      },
    ]);

    const result = googleDocsToTipTap(doc);
    const cell = result.content.content![0].content![0].content![0];
    expect(cell.content).toHaveLength(1);
    expect(cell.content![0].type).toBe('paragraph');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Inline objects / images
// ─────────────────────────────────────────────────────────────────────────────

describe('inline objects', () => {
  it('converts inline image element', () => {
    const doc = makeDoc(
      [
        {
          startIndex: 0,
          endIndex: 10,
          paragraph: {
            elements: [
              {
                startIndex: 0,
                endIndex: 1,
                inlineObjectElement: { inlineObjectId: 'obj1' },
              },
            ],
          },
        },
      ],
      {
        inlineObjects: {
          obj1: {
            objectId: 'obj1',
            inlineObjectProperties: {
              embeddedObject: {
                title: 'Test Image',
                imageProperties: {
                  contentUri: 'https://example.com/image.png',
                },
                size: {
                  width: { magnitude: 200, unit: 'PT' },
                  height: { magnitude: 100, unit: 'PT' },
                },
              },
            },
          },
        },
      },
    );

    const result = googleDocsToTipTap(doc);
    const img = result.content.content![0].content![0];
    expect(img.type).toBe('image');
    expect(img.attrs?.src).toBe('https://example.com/image.png');
    expect(img.attrs?.alt).toBe('Test Image');
  });

  it('warns when inline object is not found', () => {
    const doc = makeDoc([
      {
        startIndex: 0,
        endIndex: 10,
        paragraph: {
          elements: [
            {
              startIndex: 0,
              endIndex: 1,
              inlineObjectElement: { inlineObjectId: 'missing' },
            },
          ],
        },
      },
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe('data_loss');
    expect(result.warnings[0].message).toContain('missing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Section breaks and page breaks
// ─────────────────────────────────────────────────────────────────────────────

describe('structural elements', () => {
  it('converts page breaks', () => {
    const doc = makeDoc([
      paragraphEl([{ startIndex: 0, endIndex: 1, pageBreak: {} }]),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.content.content![0].content![0].type).toBe('pageBreak');
  });

  it('converts section breaks', () => {
    const doc = makeDoc([
      {
        startIndex: 0,
        endIndex: 1,
        sectionBreak: { sectionStyle: { sectionType: 'CONTINUOUS' } },
      },
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.content.content![0].type).toBe('sectionBreak');
    expect(result.content.content![0].attrs?.sectionType).toBe('CONTINUOUS');
  });

  it('converts horizontal rules', () => {
    const doc = makeDoc([
      paragraphEl([{ startIndex: 0, endIndex: 1, horizontalRule: {} }]),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.content.content![0].content![0].type).toBe('horizontalRule');
  });

  it('warns on unsupported table of contents', () => {
    const doc = makeDoc([
      { startIndex: 0, endIndex: 50, tableOfContents: { content: [] } },
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe('unsupported_feature');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Document structure extraction
// ─────────────────────────────────────────────────────────────────────────────

describe('document structure', () => {
  it('identifies tables as preserved elements', () => {
    const doc = makeDoc([
      paragraphEl([textElement('before\n')]),
      {
        startIndex: 10,
        endIndex: 50,
        table: {
          rows: 1,
          columns: 1,
          tableRows: [{
            startIndex: 11,
            endIndex: 49,
            tableCells: [{
              startIndex: 12,
              endIndex: 48,
              content: [paragraphEl([textElement('cell\n')])],
            }],
          }],
        },
      },
      paragraphEl([textElement('after\n')]),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.documentStructure.hasComplexContent).toBe(true);
    expect(result.documentStructure.preservedElements.length).toBeGreaterThan(0);
    expect(result.documentStructure.preservedElements[0].type).toBe('table');
  });

  it('reports no complex content for text-only documents', () => {
    const doc = makeDoc([
      paragraphEl([textElement('simple text\n')]),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.documentStructure.hasComplexContent).toBe(false);
    expect(result.documentStructure.preservedElements).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

describe('edge cases', () => {
  it('handles empty document body', () => {
    const doc = makeDoc([]);
    const result = googleDocsToTipTap(doc);
    expect(result.content.type).toBe('doc');
    expect(result.content.content).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  it('handles paragraph with no elements', () => {
    const doc = makeDoc([
      { startIndex: 0, endIndex: 1, paragraph: { elements: [] } },
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.content.content).toHaveLength(1);
    expect(result.content.content![0].type).toBe('paragraph');
    expect(result.content.content![0].content).toHaveLength(0);
  });

  it('handles small caps with approximation warning', () => {
    const doc = makeDoc([
      paragraphEl([textElement('small caps\n', { smallCaps: true })]),
    ]);

    const result = googleDocsToTipTap(doc);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].type).toBe('approximation');
    const marks = result.content.content![0].content![0].marks;
    expect(marks).toContainEqual({ type: 'textStyle', attrs: { fontVariant: 'small-caps' } });
  });
});
