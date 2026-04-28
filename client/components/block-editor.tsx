import { useEffect, useState } from "react";
import { z } from "zod/v4";

import type {
  AnyInteractiveBlock,
  BinaryBlitzConfig,
  CategorySortConfig,
  InteractiveDiagramConfig,
  SequenceSorterConfig,
  SyntaxSprintConfig,
  TileMatchConfig,
} from "../types";
import { validateInteractiveBlock } from "../types";
import { Button, Card, Field, Input, Select, Textarea } from "./ui";

type BlockEditorProps = {
  block: AnyInteractiveBlock;
  pending?: boolean;
  onDraftChange: (block: AnyInteractiveBlock) => void;
  onSave: (block: AnyInteractiveBlock) => void;
  onDelete: () => void;
  onDuplicate: () => void;
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function BlockEditor({
  block,
  onDraftChange,
  onSave,
  onDelete,
  onDuplicate,
  pending,
}: BlockEditorProps) {
  const [draft, setDraft] = useState(block);
  const [showRawJson, setShowRawJson] = useState(false);
  const [rawJson, setRawJson] = useState(JSON.stringify(block.config, null, 2));
  const [rawJsonError, setRawJsonError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(block);
    setRawJson(JSON.stringify(block.config, null, 2));
    setRawJsonError(null);
  }, [block]);

  useEffect(() => {
    onDraftChange(draft);
  }, [draft, onDraftChange]);

  const validationMessages = validateInteractiveBlock(draft);

  function updateDraft(next: AnyInteractiveBlock) {
    setDraft(next);
    setRawJson(JSON.stringify(next.config, null, 2));
  }

  function updateConfig(nextConfig: AnyInteractiveBlock["config"]) {
    updateDraft({
      ...draft,
      config: nextConfig as never,
    });
  }

  function applyRawJson() {
    const result = z.string().transform((s, ctx) => {
      try { return JSON.parse(s) as AnyInteractiveBlock["config"]; }
      catch (e) { ctx.addIssue({ input: s, code: "custom", message: e instanceof Error ? e.message : "Invalid JSON" }); return z.NEVER; }
    }).safeParse(rawJson);

    if (!result.success) {
      setRawJsonError(result.error.issues[0]?.message ?? "Invalid JSON");
      return;
    }
    setRawJsonError(null);
    updateConfig(result.data);
  }

  return (
    <div className="stack-lg">
      <Card
        actions={
          <div className="button-row">
            <Button onClick={onDuplicate} type="button" variant="secondary">
              Duplicate
            </Button>
            <Button onClick={onDelete} type="button" variant="danger">
              Delete
            </Button>
          </div>
        }
        subtitle="Structured configuration backed by a typed block schema."
        title="Block Editor"
      >
        <div className="form-grid">
          <Field label="Title">
            <Input
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  title: event.currentTarget.value,
                })
              }
              value={draft.title}
            />
          </Field>
          <Field label="Description">
            <Textarea
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  description: event.currentTarget.value,
                })
              }
              rows={3}
              value={draft.description ?? ""}
            />
          </Field>
        </div>
      </Card>

      <Card subtitle="Reusable settings shared across preview and player." title="Settings">
        <div className="form-grid split">
          <Field label="Timer Seconds">
            <Input
              min={0}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  settings: {
                    ...draft.settings,
                    timerSeconds: event.currentTarget.value
                      ? Number(event.currentTarget.value)
                      : undefined,
                  },
                })
              }
              type="number"
              value={draft.settings.timerSeconds ?? ""}
            />
          </Field>
          <Field label="Difficulty">
            <Select
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  settings: {
                    ...draft.settings,
                    difficulty: event.currentTarget.value
                      ? (event.currentTarget.value as "easy" | "medium" | "hard")
                      : undefined,
                  },
                })
              }
              value={draft.settings.difficulty ?? ""}
            >
              <option value="">Not set</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </Select>
          </Field>
        </div>
        <div className="checkbox-row">
          <label className="checkbox">
            <input
              checked={draft.settings.showScore}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  settings: {
                    ...draft.settings,
                    showScore: event.currentTarget.checked,
                  },
                })
              }
              type="checkbox"
            />
            <span>Show score in player</span>
          </label>
          <label className="checkbox">
            <input
              checked={draft.settings.allowRetry}
              onChange={(event) =>
                updateDraft({
                  ...draft,
                  settings: {
                    ...draft.settings,
                    allowRetry: event.currentTarget.checked,
                  },
                })
              }
              type="checkbox"
            />
            <span>Allow retry</span>
          </label>
        </div>
      </Card>

      <Card
        actions={
          <Button onClick={() => setShowRawJson((current) => !current)} type="button" variant="ghost">
            {showRawJson ? "Hide JSON" : "Inspect JSON"}
          </Button>
        }
        subtitle="Forms stay block-specific while advanced authors can inspect the raw config."
        title="Block Config"
      >
        <ConfigEditor block={draft} onChange={updateConfig} />
        {showRawJson ? (
          <div className="stack">
            <Field label="Raw JSON">
              <Textarea onChange={(event) => setRawJson(event.currentTarget.value)} rows={14} value={rawJson} />
            </Field>
            {rawJsonError ? <p className="inline-error">{rawJsonError}</p> : null}
            <div className="button-row">
              <Button onClick={applyRawJson} type="button" variant="secondary">
                Apply JSON
              </Button>
            </div>
          </div>
        ) : null}
      </Card>

      <Card subtitle="Validation is shared conceptually with the server-side checks." title="Validation">
        {validationMessages.length ? (
          <ul className="validation-list">
            {validationMessages.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        ) : (
          <p className="success-copy">This block is ready to preview and save.</p>
        )}
      </Card>

      <div className="button-row">
        <Button
          disabled={Boolean(rawJsonError) || validationMessages.length > 0 || pending}
          onClick={() => onSave(draft)}
          type="button"
        >
          {pending ? "Saving..." : "Save Block"}
        </Button>
      </div>
    </div>
  );
}

function ConfigEditor({
  block,
  onChange,
}: {
  block: AnyInteractiveBlock;
  onChange: (config: AnyInteractiveBlock["config"]) => void;
}) {
  switch (block.type) {
    case "tile-match":
      return (
        <TileMatchEditor
          config={block.config as TileMatchConfig}
          onChange={(config) => onChange(config)}
        />
      );
    case "category-sort":
      return (
        <CategorySortEditor
          config={block.config as CategorySortConfig}
          onChange={(config) => onChange(config)}
        />
      );
    case "sequence-sorter":
      return (
        <SequenceSorterEditor
          config={block.config as SequenceSorterConfig}
          onChange={(config) => onChange(config)}
        />
      );
    case "interactive-diagram":
      return (
        <InteractiveDiagramEditor
          config={block.config as InteractiveDiagramConfig}
          onChange={(config) => onChange(config)}
        />
      );
    case "syntax-sprint":
      return (
        <SyntaxSprintEditor
          config={block.config as SyntaxSprintConfig}
          onChange={(config) => onChange(config)}
        />
      );
    case "binary-blitz":
      return (
        <BinaryBlitzEditor
          config={block.config as BinaryBlitzConfig}
          onChange={(config) => onChange(config)}
        />
      );
  }
}

function TileMatchEditor({
  config,
  onChange,
}: {
  config: TileMatchConfig;
  onChange: (config: TileMatchConfig) => void;
}) {
  return (
    <div className="stack">
      <Field label="Prompt">
        <Textarea
          onChange={(event) => onChange({ ...config, prompt: event.currentTarget.value })}
          rows={2}
          value={config.prompt}
        />
      </Field>
      {config.pairs.map((pair) => (
        <div className="form-grid split" key={pair.id}>
          <Field label="Left">
            <Input
              onChange={(event) =>
                onChange({
                  ...config,
                  pairs: config.pairs.map((candidate) =>
                    candidate.id === pair.id
                      ? { ...candidate, left: event.currentTarget.value }
                      : candidate,
                  ),
                })
              }
              value={pair.left}
            />
          </Field>
          <Field label="Right">
            <Input
              onChange={(event) =>
                onChange({
                  ...config,
                  pairs: config.pairs.map((candidate) =>
                    candidate.id === pair.id
                      ? { ...candidate, right: event.currentTarget.value }
                      : candidate,
                  ),
                })
              }
              value={pair.right}
            />
          </Field>
        </div>
      ))}
      <Button
        onClick={() =>
          onChange({
            ...config,
            pairs: [...config.pairs, { id: makeId("pair"), left: "", right: "" }],
          })
        }
        type="button"
        variant="secondary"
      >
        Add Pair
      </Button>
    </div>
  );
}

function CategorySortEditor({
  config,
  onChange,
}: {
  config: CategorySortConfig;
  onChange: (config: CategorySortConfig) => void;
}) {
  return (
    <div className="stack">
      <Field label="Prompt">
        <Textarea
          onChange={(event) => onChange({ ...config, prompt: event.currentTarget.value })}
          rows={2}
          value={config.prompt}
        />
      </Field>
      <div className="stack">
        <strong>Categories</strong>
        {config.categories.map((category) => (
          <Field key={category.id} label="Category Label">
            <Input
              onChange={(event) =>
                onChange({
                  ...config,
                  categories: config.categories.map((candidate) =>
                    candidate.id === category.id
                      ? { ...candidate, label: event.currentTarget.value }
                      : candidate,
                  ),
                })
              }
              value={category.label}
            />
          </Field>
        ))}
        <Button
          onClick={() =>
            onChange({
              ...config,
              categories: [...config.categories, { id: makeId("category"), label: "" }],
            })
          }
          type="button"
          variant="secondary"
        >
          Add Category
        </Button>
      </div>
      <div className="stack">
        <strong>Items</strong>
        {config.items.map((item) => (
          <div className="form-grid split" key={item.id}>
            <Field label="Item Text">
              <Input
                onChange={(event) =>
                  onChange({
                    ...config,
                    items: config.items.map((candidate) =>
                      candidate.id === item.id
                        ? { ...candidate, label: event.currentTarget.value }
                        : candidate,
                    ),
                  })
                }
                value={item.label}
              />
            </Field>
            <Field label="Correct Category">
              <Select
                onChange={(event) =>
                  onChange({
                    ...config,
                    items: config.items.map((candidate) =>
                      candidate.id === item.id
                        ? { ...candidate, categoryId: event.currentTarget.value }
                        : candidate,
                    ),
                  })
                }
                value={item.categoryId}
              >
                {config.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label || "Untitled category"}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        ))}
        <Button
          onClick={() =>
            onChange({
              ...config,
              items: [
                ...config.items,
                {
                  id: makeId("item"),
                  label: "",
                  categoryId: config.categories[0]?.id ?? "",
                },
              ],
            })
          }
          type="button"
          variant="secondary"
        >
          Add Item
        </Button>
      </div>
    </div>
  );
}

function SequenceSorterEditor({
  config,
  onChange,
}: {
  config: SequenceSorterConfig;
  onChange: (config: SequenceSorterConfig) => void;
}) {
  return (
    <div className="stack">
      <Field label="Prompt">
        <Textarea
          onChange={(event) => onChange({ ...config, prompt: event.currentTarget.value })}
          rows={2}
          value={config.prompt}
        />
      </Field>
      {config.items.map((item) => (
        <div className="form-grid split" key={item.id}>
          <Field label="Step">
            <Input
              onChange={(event) =>
                onChange({
                  ...config,
                  items: config.items.map((candidate) =>
                    candidate.id === item.id
                      ? { ...candidate, label: event.currentTarget.value }
                      : candidate,
                  ),
                })
              }
              value={item.label}
            />
          </Field>
          <Field label="Explanation">
            <Input
              onChange={(event) =>
                onChange({
                  ...config,
                  items: config.items.map((candidate) =>
                    candidate.id === item.id
                      ? { ...candidate, explanation: event.currentTarget.value }
                      : candidate,
                  ),
                })
              }
              value={item.explanation ?? ""}
            />
          </Field>
        </div>
      ))}
      <Button
        onClick={() =>
          onChange({
            ...config,
            items: [...config.items, { id: makeId("step"), label: "", explanation: "" }],
          })
        }
        type="button"
        variant="secondary"
      >
        Add Step
      </Button>
    </div>
  );
}

function InteractiveDiagramEditor({
  config,
  onChange,
}: {
  config: InteractiveDiagramConfig;
  onChange: (config: InteractiveDiagramConfig) => void;
}) {
  return (
    <div className="stack">
      <Field label="Prompt">
        <Textarea
          onChange={(event) => onChange({ ...config, prompt: event.currentTarget.value })}
          rows={2}
          value={config.prompt}
        />
      </Field>
      <Field label="Image URL" hint="Use a hosted image URL for the MVP data model.">
        <Input
          onChange={(event) => onChange({ ...config, imageUrl: event.currentTarget.value })}
          value={config.imageUrl}
        />
      </Field>
      {config.hotspots.map((hotspot) => (
        <div className="panel-grid" key={hotspot.id}>
          <Field label="Label">
            <Input
              onChange={(event) =>
                onChange({
                  ...config,
                  hotspots: config.hotspots.map((candidate) =>
                    candidate.id === hotspot.id
                      ? { ...candidate, label: event.currentTarget.value }
                      : candidate,
                  ),
                })
              }
              value={hotspot.label}
            />
          </Field>
          <Field label="Description">
            <Input
              onChange={(event) =>
                onChange({
                  ...config,
                  hotspots: config.hotspots.map((candidate) =>
                    candidate.id === hotspot.id
                      ? { ...candidate, description: event.currentTarget.value }
                      : candidate,
                  ),
                })
              }
              value={hotspot.description ?? ""}
            />
          </Field>
          <div className="form-grid split triple">
            <Field label="X (%)">
              <Input
                onChange={(event) =>
                  onChange({
                    ...config,
                    hotspots: config.hotspots.map((candidate) =>
                      candidate.id === hotspot.id
                        ? { ...candidate, x: Number(event.currentTarget.value) }
                        : candidate,
                    ),
                  })
                }
                type="number"
                value={hotspot.x}
              />
            </Field>
            <Field label="Y (%)">
              <Input
                onChange={(event) =>
                  onChange({
                    ...config,
                    hotspots: config.hotspots.map((candidate) =>
                      candidate.id === hotspot.id
                        ? { ...candidate, y: Number(event.currentTarget.value) }
                        : candidate,
                    ),
                  })
                }
                type="number"
                value={hotspot.y}
              />
            </Field>
            <Field label="Radius">
              <Input
                onChange={(event) =>
                  onChange({
                    ...config,
                    hotspots: config.hotspots.map((candidate) =>
                      candidate.id === hotspot.id
                        ? { ...candidate, radius: Number(event.currentTarget.value) }
                        : candidate,
                    ),
                  })
                }
                type="number"
                value={hotspot.radius}
              />
            </Field>
          </div>
        </div>
      ))}
      <Button
        onClick={() =>
          onChange({
            ...config,
            hotspots: [
              ...config.hotspots,
              {
                id: makeId("hotspot"),
                label: "",
                description: "",
                x: 50,
                y: 50,
                radius: 14,
              },
            ],
          })
        }
        type="button"
        variant="secondary"
      >
        Add Hotspot
      </Button>
    </div>
  );
}

function SyntaxSprintEditor({
  config,
  onChange,
}: {
  config: SyntaxSprintConfig;
  onChange: (config: SyntaxSprintConfig) => void;
}) {
  return (
    <div className="stack">
      <Field label="Prompt">
        <Textarea
          onChange={(event) => onChange({ ...config, prompt: event.currentTarget.value })}
          rows={2}
          value={config.prompt}
        />
      </Field>
      <Field label="Target Text">
        <Textarea
          onChange={(event) => onChange({ ...config, targetText: event.currentTarget.value })}
          rows={6}
          value={config.targetText}
        />
      </Field>
      <div className="form-grid split">
        <Field label="Language Hint">
          <Input
            onChange={(event) => onChange({ ...config, languageHint: event.currentTarget.value })}
            value={config.languageHint}
          />
        </Field>
        <label className="checkbox">
          <input
            checked={config.caseSensitive}
            onChange={(event) =>
              onChange({
                ...config,
                caseSensitive: event.currentTarget.checked,
              })
            }
            type="checkbox"
          />
          <span>Case sensitive</span>
        </label>
      </div>
    </div>
  );
}

function BinaryBlitzEditor({
  config,
  onChange,
}: {
  config: BinaryBlitzConfig;
  onChange: (config: BinaryBlitzConfig) => void;
}) {
  return (
    <div className="stack">
      <Field label="Prompt">
        <Textarea
          onChange={(event) => onChange({ ...config, prompt: event.currentTarget.value })}
          rows={2}
          value={config.prompt}
        />
      </Field>
      {config.statements.map((statement) => (
        <div className="panel-grid" key={statement.id}>
          <Field label="Statement">
            <Input
              onChange={(event) =>
                onChange({
                  ...config,
                  statements: config.statements.map((candidate) =>
                    candidate.id === statement.id
                      ? { ...candidate, text: event.currentTarget.value }
                      : candidate,
                  ),
                })
              }
              value={statement.text}
            />
          </Field>
          <Field label="Explanation">
            <Input
              onChange={(event) =>
                onChange({
                  ...config,
                  statements: config.statements.map((candidate) =>
                    candidate.id === statement.id
                      ? { ...candidate, explanation: event.currentTarget.value }
                      : candidate,
                  ),
                })
              }
              value={statement.explanation ?? ""}
            />
          </Field>
          <label className="checkbox">
            <input
              checked={statement.isTrue}
              onChange={(event) =>
                onChange({
                  ...config,
                  statements: config.statements.map((candidate) =>
                    candidate.id === statement.id
                      ? { ...candidate, isTrue: event.currentTarget.checked }
                      : candidate,
                  ),
                })
              }
              type="checkbox"
            />
            <span>Correct answer is true</span>
          </label>
        </div>
      ))}
      <Button
        onClick={() =>
          onChange({
            ...config,
            statements: [
              ...config.statements,
              { id: makeId("statement"), text: "", isTrue: true, explanation: "" },
            ],
          })
        }
        type="button"
        variant="secondary"
      >
        Add Statement
      </Button>
    </div>
  );
}

