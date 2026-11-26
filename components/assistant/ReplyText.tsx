import { palette, spacing } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

type Block = { kind: 'paragraph' | 'item' | 'heading'; text: string; marker?: string; gap: boolean };

/** Splits a reply into paragraphs, list items and headings; other Markdown is shown as written. */
function parse(reply: string) {
  const blocks: Block[] = [];
  let gap = false;

  for (const raw of reply.split('\n')) {
    const line = raw.trim();
    if (!line) {
      gap = true;
      continue;
    }
    const bullet = line.match(/^[-*•–‑]\s+(.*)$/);
    const numbered = line.match(/^(\d{1,2})[.)]\s+(.*)$/);
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (bullet) {
      blocks.push({ kind: 'item', marker: '•', text: bullet[1], gap });
    } else if (numbered) {
      blocks.push({ kind: 'item', marker: `${numbered[1]}.`, text: numbered[2], gap });
    } else if (heading) {
      blocks.push({ kind: 'heading', text: heading[1].replace(/\*\*/g, ''), gap });
    } else {
      blocks.push({ kind: 'paragraph', text: line, gap });
    }
    gap = false;
  }
  return blocks;
}

function Inline({ text }: { text: string }) {
  // Every second piece sits between ** markers.
  return text.split('**').map((part, index) => (
    <Text key={index} style={index % 2 === 1 ? styles.bold : undefined}>
      {part}
    </Text>
  ));
}

export function ReplyText({ reply }: { reply: string }) {
  return (
    <View>
      {parse(reply).map((block, index) => (
        <View
          key={index}
          style={[index > 0 && (block.gap ? styles.gap : styles.tight), block.kind === 'item' && styles.item]}>
          {block.marker ? <Text style={[styles.text, styles.marker]}>{block.marker}</Text> : null}
          <Text selectable style={[styles.text, block.kind === 'item' && styles.itemText, block.kind === 'heading' && styles.bold]}>
            <Inline text={block.text} />
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  text: {
    color: palette.ink,
    fontSize: 16,
    lineHeight: 25,
  },
  bold: {
    fontWeight: '800',
  },
  gap: {
    marginTop: spacing.md,
  },
  tight: {
    marginTop: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  marker: {
    color: palette.emerald,
    fontWeight: '800',
    minWidth: 18,
    textAlign: 'right',
  },
  itemText: {
    flex: 1,
  },
});
