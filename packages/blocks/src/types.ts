export type BlockType =
  | "tile-match"
  | "category-sort"
  | "sequence-sorter"
  | "interactive-diagram"
  | "syntax-sprint"
  | "binary-blitz";

export type Difficulty = "easy" | "medium" | "hard";

export type BlockSettings = {
  timerSeconds?: number;
  showScore: boolean;
  allowRetry: boolean;
  difficulty?: Difficulty;
};

export type TileMatchConfig = {
  prompt: string;
  pairs: Array<{
    id: string;
    left: string;
    right: string;
  }>;
};

export type CategorySortConfig = {
  prompt: string;
  categories: Array<{
    id: string;
    label: string;
  }>;
  items: Array<{
    id: string;
    label: string;
    categoryId: string;
  }>;
};

export type SequenceSorterConfig = {
  prompt: string;
  items: Array<{
    id: string;
    label: string;
    explanation?: string;
  }>;
};

export type InteractiveDiagramConfig = {
  prompt: string;
  imageUrl: string;
  hotspots: Array<{
    id: string;
    label: string;
    description?: string;
    x: number;
    y: number;
    radius: number;
  }>;
};

export type SyntaxSprintConfig = {
  prompt: string;
  targetText: string;
  languageHint: string;
  caseSensitive: boolean;
};

export type BinaryBlitzConfig = {
  prompt: string;
  statements: Array<{
    id: string;
    text: string;
    isTrue: boolean;
    explanation?: string;
  }>;
};

export type BlockConfigMap = {
  "tile-match": TileMatchConfig;
  "category-sort": CategorySortConfig;
  "sequence-sorter": SequenceSorterConfig;
  "interactive-diagram": InteractiveDiagramConfig;
  "syntax-sprint": SyntaxSprintConfig;
  "binary-blitz": BinaryBlitzConfig;
};

export type InteractiveBlock<T extends BlockType = BlockType> = {
  id: string;
  type: T;
  title: string;
  description?: string | null;
  config: BlockConfigMap[T];
  settings: BlockSettings;
};

export type AnyInteractiveBlock = {
  [T in BlockType]: InteractiveBlock<T>;
}[BlockType];

export type BlockCatalogEntry = {
  type: BlockType;
  name: string;
  objective: string;
  description: string;
  mvp: boolean;
};

export const DEFAULT_BLOCK_SETTINGS: BlockSettings = {
  showScore: true,
  allowRetry: true,
};

export const BLOCK_CATALOG: BlockCatalogEntry[] = [
  {
    type: "tile-match",
    name: "Tile Match",
    objective: "Memorization of paired concepts",
    description: "Match image-text or text-text pairs to reinforce recall.",
    mvp: true,
  },
  {
    type: "category-sort",
    name: "Category Sort",
    objective: "Classification and grouping",
    description: "Sort concepts into clear buckets based on their traits.",
    mvp: true,
  },
  {
    type: "sequence-sorter",
    name: "Sequence Sorter",
    objective: "Timelines and process order",
    description: "Rebuild a process, procedure, or timeline in the right order.",
    mvp: true,
  },
  {
    type: "interactive-diagram",
    name: "Interactive Diagram",
    objective: "Anatomy and part identification",
    description: "Use hotspots to inspect and identify key regions in a visual.",
    mvp: true,
  },
  {
    type: "syntax-sprint",
    name: "Syntax Sprint",
    objective: "Typing accuracy and fluency",
    description: "Type a target string accurately with immediate feedback.",
    mvp: true,
  },
  {
    type: "binary-blitz",
    name: "Binary Blitz",
    objective: "Rapid recognition and classification",
    description: "Make quick true/false style judgments on a set of prompts.",
    mvp: true,
  },
];

export function catalogEntryFor(type: BlockType) {
  return BLOCK_CATALOG.find((entry) => entry.type === type) ?? BLOCK_CATALOG[0];
}

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createDefaultBlock(type: BlockType): AnyInteractiveBlock {
  const entry = catalogEntryFor(type);
  const id = makeId("block");
  switch (type) {
    case "tile-match":
      return {
        id,
        type,
        title: entry.name,
        description: "Match each concept with its correct pair.",
        settings: { ...DEFAULT_BLOCK_SETTINGS },
        config: {
          prompt: "Match the term to its definition.",
          pairs: [
            { id: makeId("pair"), left: "Neuron", right: "Cell that carries signals" },
            { id: makeId("pair"), left: "Axon", right: "Long projection that sends impulses" },
          ],
        },
      };
    case "category-sort":
      return {
        id,
        type,
        title: entry.name,
        description: "Sort each example into the correct category.",
        settings: { ...DEFAULT_BLOCK_SETTINGS },
        config: {
          prompt: "Classify each example.",
          categories: [
            { id: makeId("category"), label: "Mammal" },
            { id: makeId("category"), label: "Bird" },
          ],
          items: [],
        },
      };
    case "sequence-sorter":
      return {
        id,
        type,
        title: entry.name,
        description: "Arrange the process in the right order.",
        settings: { ...DEFAULT_BLOCK_SETTINGS },
        config: {
          prompt: "Order the steps from first to last.",
          items: [
            { id: makeId("step"), label: "Gather materials" },
            { id: makeId("step"), label: "Assemble components" },
            { id: makeId("step"), label: "Inspect the result" },
          ],
        },
      };
    case "interactive-diagram":
      return {
        id,
        type,
        title: entry.name,
        description: "Explore the diagram and find each hotspot.",
        settings: { ...DEFAULT_BLOCK_SETTINGS },
        config: {
          prompt: "Identify the highlighted parts of the diagram.",
          imageUrl:
            "https://images.unsplash.com/photo-1511174511562-5f97f4f4a5d7?auto=format&fit=crop&w=1200&q=80",
          hotspots: [
            {
              id: makeId("hotspot"),
              label: "Primary assembly",
              description: "The central mechanism learners should identify first.",
              x: 38,
              y: 42,
              radius: 16,
            },
          ],
        },
      };
    case "syntax-sprint":
      return {
        id,
        type,
        title: entry.name,
        description: "Type the reference string accurately.",
        settings: { ...DEFAULT_BLOCK_SETTINGS, timerSeconds: 45 },
        config: {
          prompt: "Reproduce the syntax sample exactly.",
          targetText: "const velocity = distance / time;",
          languageHint: "JavaScript",
          caseSensitive: true,
        },
      };
    case "binary-blitz":
      return {
        id,
        type,
        title: entry.name,
        description: "Make fast true or false judgments.",
        settings: { ...DEFAULT_BLOCK_SETTINGS, timerSeconds: 30 },
        config: {
          prompt: "Decide whether each statement is correct.",
          statements: [
            {
              id: makeId("statement"),
              text: "Mitochondria generate most of a cell's ATP.",
              isTrue: true,
            },
            {
              id: makeId("statement"),
              text: "A triangle always has four sides.",
              isTrue: false,
            },
          ],
        },
      };
  }
}

export function validateInteractiveBlock(block: AnyInteractiveBlock): string[] {
  const messages: string[] = [];
  if (!block.title.trim()) {
    messages.push("Block title is required.");
  }

  switch (block.type) {
    case "tile-match":
      if (!block.config.prompt.trim()) {
        messages.push("Tile Match needs a prompt.");
      }
      if (block.config.pairs.length < 2) {
        messages.push("Tile Match needs at least two pairs.");
      }
      if (block.config.pairs.some((pair) => !pair.left.trim() || !pair.right.trim())) {
        messages.push("Every Tile Match pair needs both values.");
      }
      break;
    case "category-sort":
      if (!block.config.prompt.trim()) {
        messages.push("Category Sort needs a prompt.");
      }
      if (block.config.categories.length < 2) {
        messages.push("Category Sort needs at least two categories.");
      }
      if (block.config.items.length < 2) {
        messages.push("Category Sort needs at least two items.");
      }
      if (block.config.categories.some((category) => !category.label.trim())) {
        messages.push("Every category needs a label.");
      }
      if (
        block.config.items.some(
          (item) =>
            !item.label.trim() ||
            !block.config.categories.some((category) => category.id === item.categoryId),
        )
      ) {
        messages.push("Each Category Sort item needs text and a valid category.");
      }
      break;
    case "sequence-sorter":
      if (!block.config.prompt.trim()) {
        messages.push("Sequence Sorter needs a prompt.");
      }
      if (block.config.items.length < 2) {
        messages.push("Sequence Sorter needs at least two steps.");
      }
      if (block.config.items.some((item) => !item.label.trim())) {
        messages.push("Sequence Sorter steps cannot be blank.");
      }
      break;
    case "interactive-diagram":
      if (!block.config.prompt.trim()) {
        messages.push("Interactive Diagram needs a prompt.");
      }
      if (!block.config.imageUrl.trim()) {
        messages.push("Interactive Diagram needs an image URL.");
      }
      if (block.config.hotspots.length < 1) {
        messages.push("Interactive Diagram needs at least one hotspot.");
      }
      if (
        block.config.hotspots.some(
          (hotspot) => !hotspot.label.trim() || hotspot.radius <= 0,
        )
      ) {
        messages.push("Every hotspot needs a label and positive radius.");
      }
      break;
    case "syntax-sprint":
      if (!block.config.prompt.trim()) {
        messages.push("Syntax Sprint needs a prompt.");
      }
      if (!block.config.targetText.trim()) {
        messages.push("Syntax Sprint needs a target text.");
      }
      break;
    case "binary-blitz":
      if (!block.config.prompt.trim()) {
        messages.push("Binary Blitz needs a prompt.");
      }
      if (block.config.statements.length < 2) {
        messages.push("Binary Blitz needs at least two statements.");
      }
      if (block.config.statements.some((statement) => !statement.text.trim())) {
        messages.push("Binary Blitz statements cannot be blank.");
      }
      break;
  }

  return messages;
}

