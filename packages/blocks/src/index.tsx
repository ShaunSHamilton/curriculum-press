import { useEffect, useMemo, useState } from "react";

import type {
  AnyInteractiveBlock,
  BinaryBlitzConfig,
  CategorySortConfig,
  InteractiveBlock,
  InteractiveDiagramConfig,
  SequenceSorterConfig,
  SyntaxSprintConfig,
  TileFace,
  TileMatchConfig,
} from "./types";

export type BlockRendererProps = {
  block: AnyInteractiveBlock;
};

export type CurriculumPlayerProps = {
  blocks: AnyInteractiveBlock[];
};

type PlayerCardProps = {
  eyebrow: string;
  title: string;
  body?: string | null;
  footer?: string;
  children: React.ReactNode;
};

function PlayerCard({ eyebrow, title, body, footer, children }: PlayerCardProps) {
  return (
    <section className="cp-player-card">
      <div className="cp-player-header">
        <span className="cp-player-eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        {body ? <p>{body}</p> : null}
      </div>
      <div className="cp-player-body">{children}</div>
      {footer ? <div className="cp-player-footer">{footer}</div> : null}
    </section>
  );
}

function TileFaceContent({ face }: { face: TileFace }) {
  if (face.kind === "image") {
    return <img className="cp-memory-image" src={face.imageUrl} alt={face.alt ?? ""} />;
  }
  return <span>{face.text}</span>;
}

function TileMatchBlock({ block }: { block: InteractiveBlock<"tile-match"> }) {
  const { pairs, prompt } = block.config as TileMatchConfig;
  const deck = useMemo(() => {
    const cards = pairs.flatMap((pair) => [
      { id: `${pair.id}-left`, pairId: pair.id, face: pair.left },
      { id: `${pair.id}-right`, pairId: pair.id, face: pair.right },
    ]);

    return [...cards].sort(() => Math.random() - 0.5);
  }, [pairs]);
  const [revealedCards, setRevealedCards] = useState<string[]>([]);
  const [matchedPairs, setMatchedPairs] = useState<string[]>([]);
  const [turns, setTurns] = useState(0);

  useEffect(() => {
    setRevealedCards([]);
    setMatchedPairs([]);
    setTurns(0);
  }, [deck]);

  useEffect(() => {
    if (revealedCards.length !== 2) {
      return;
    }

    const [firstId, secondId] = revealedCards;
    const firstCard = deck.find((card) => card.id === firstId);
    const secondCard = deck.find((card) => card.id === secondId);

    if (!firstCard || !secondCard) {
      setRevealedCards([]);
      return;
    }

    if (firstCard.pairId === secondCard.pairId) {
      setMatchedPairs((current) => [...current, firstCard.pairId]);
      setRevealedCards([]);
      return;
    }

    const timeout = window.setTimeout(() => {
      setRevealedCards([]);
    }, 850);

    return () => window.clearTimeout(timeout);
  }, [deck, revealedCards]);

  return (
    <PlayerCard
      eyebrow="Tile Match"
      title={block.title}
      body={block.description}
      footer={`${matchedPairs.length} / ${pairs.length} matched in ${turns} turn${turns === 1 ? "" : "s"}`}
    >
      <p className="cp-prompt">{prompt}</p>
      <div className="cp-memory-grid">
        {deck.map((card) => {
          const isMatched = matchedPairs.includes(card.pairId);
          const isRevealed = isMatched || revealedCards.includes(card.id);

          return (
            <button
              key={card.id}
              className={`cp-memory-card ${isMatched ? "is-complete" : ""} ${
                isRevealed ? "is-revealed" : ""
              }`}
              disabled={isMatched || revealedCards.length === 2 || revealedCards.includes(card.id)}
              onClick={() => {
                setRevealedCards((current) => [...current, card.id]);
                setTurns((current) => current + (revealedCards.length === 1 ? 1 : 0));
              }}
              type="button"
            >
              {isRevealed ? <TileFaceContent face={card.face} /> : <span>?</span>}
            </button>
          );
        })}
      </div>
    </PlayerCard>
  );
}

function CategorySortBlock({ block }: { block: InteractiveBlock<"category-sort"> }) {
  const { categories, items, prompt } = block.config as CategorySortConfig;
  const [placements, setPlacements] = useState<Record<string, string>>({});
  const correct = items.filter((item) => placements[item.id] === item.categoryId).length;

  return (
    <PlayerCard
      eyebrow="Category Sort"
      title={block.title}
      body={block.description}
      footer={`${correct} / ${items.length} placed correctly`}
    >
      <p className="cp-prompt">{prompt}</p>
      <div className="cp-stack">
        {items.map((item) => (
          <div className="cp-inline-card" key={item.id}>
            <div>
              <strong>{item.label}</strong>
            </div>
            <div className="cp-chip-row">
              {categories.map((category) => {
                const active = placements[item.id] === category.id;
                const isCorrect = active && category.id === item.categoryId;
                return (
                  <button
                    key={category.id}
                    className={`cp-chip-button ${active ? "is-active" : ""} ${
                      isCorrect ? "is-success" : ""
                    }`}
                    onClick={() =>
                      setPlacements((current) => ({ ...current, [item.id]: category.id }))
                    }
                    type="button"
                  >
                    {category.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </PlayerCard>
  );
}

function SequenceSorterBlock({ block }: { block: InteractiveBlock<"sequence-sorter"> }) {
  const { items, prompt } = block.config as SequenceSorterConfig;
  const [orderedItems, setOrderedItems] = useState(items);

  useEffect(() => {
    setOrderedItems(items);
  }, [items]);

  const isCorrect = orderedItems.every((item, index) => item.id === items[index]?.id);

  return (
    <PlayerCard
      eyebrow="Sequence Sorter"
      title={block.title}
      body={block.description}
      footer={isCorrect ? "Sequence is correct" : "Use the arrows to reorder the sequence"}
    >
      <p className="cp-prompt">{prompt}</p>
      <div className="cp-stack">
        {orderedItems.map((item, index) => (
          <div className="cp-inline-card" key={item.id}>
            <div>
              <strong>{index + 1}.</strong> {item.label}
            </div>
            <div className="cp-chip-row">
              <button
                className="cp-chip-button"
                disabled={index === 0}
                onClick={() =>
                  setOrderedItems((current) => {
                    const next = [...current];
                    [next[index - 1], next[index]] = [next[index], next[index - 1]];
                    return next;
                  })
                }
                type="button"
              >
                Up
              </button>
              <button
                className="cp-chip-button"
                disabled={index === orderedItems.length - 1}
                onClick={() =>
                  setOrderedItems((current) => {
                    const next = [...current];
                    [next[index], next[index + 1]] = [next[index + 1], next[index]];
                    return next;
                  })
                }
                type="button"
              >
                Down
              </button>
            </div>
          </div>
        ))}
      </div>
    </PlayerCard>
  );
}

function InteractiveDiagramBlock({ block }: { block: InteractiveBlock<"interactive-diagram"> }) {
  const { hotspots, imageUrl, prompt } = block.config as InteractiveDiagramConfig;
  const [activeHotspotId, setActiveHotspotId] = useState<string | null>(hotspots[0]?.id ?? null);
  const activeHotspot = hotspots.find((hotspot) => hotspot.id === activeHotspotId) ?? hotspots[0];

  return (
    <PlayerCard
      eyebrow="Interactive Diagram"
      title={block.title}
      body={block.description}
      footer={`${hotspots.length} hotspot${hotspots.length === 1 ? "" : "s"} configured`}
    >
      <p className="cp-prompt">{prompt}</p>
      <div className="cp-diagram-shell">
        <div className="cp-diagram-stage">
          <img alt={block.title} className="cp-diagram-image" src={imageUrl} />
          {hotspots.map((hotspot) => (
            <button
              key={hotspot.id}
              className={`cp-hotspot ${activeHotspotId === hotspot.id ? "is-active" : ""}`}
              onClick={() => setActiveHotspotId(hotspot.id)}
              style={{
                left: `${hotspot.x}%`,
                top: `${hotspot.y}%`,
                width: `${hotspot.radius * 2}px`,
                height: `${hotspot.radius * 2}px`,
              }}
              type="button"
            />
          ))}
        </div>
        <div className="cp-diagram-panel">
          <strong>{activeHotspot?.label ?? "Select a hotspot"}</strong>
          <p>{activeHotspot?.description ?? "Click a hotspot to inspect its explanation."}</p>
        </div>
      </div>
    </PlayerCard>
  );
}

function SyntaxSprintBlock({ block }: { block: InteractiveBlock<"syntax-sprint"> }) {
  const { prompt, targetText, languageHint, caseSensitive } = block.config as SyntaxSprintConfig;
  const [answer, setAnswer] = useState("");
  const normalizedTarget = caseSensitive ? targetText : targetText.toLowerCase();
  const normalizedAnswer = caseSensitive ? answer : answer.toLowerCase();
  const matches = normalizedAnswer === normalizedTarget;
  const accuracy = Math.round(
    (Math.min(answer.length, targetText.length) / Math.max(targetText.length, 1)) * 100,
  );

  return (
    <PlayerCard
      eyebrow="Syntax Sprint"
      title={block.title}
      body={block.description}
      footer={matches ? "Perfect match" : `${accuracy}% of target length entered`}
    >
      <p className="cp-prompt">{prompt}</p>
      <div className="cp-code-reference">
        <span>{languageHint || "Reference"}</span>
        <pre>{targetText}</pre>
      </div>
      <textarea
        className="cp-textarea"
        onChange={(event) => setAnswer(event.currentTarget.value)}
        placeholder="Type the sample here..."
        rows={5}
        value={answer}
      />
    </PlayerCard>
  );
}

function BinaryBlitzBlock({ block }: { block: InteractiveBlock<"binary-blitz"> }) {
  const { prompt, statements } = block.config as BinaryBlitzConfig;
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const correct = statements.filter((statement) => answers[statement.id] === statement.isTrue).length;

  return (
    <PlayerCard
      eyebrow="Binary Blitz"
      title={block.title}
      body={block.description}
      footer={`${correct} / ${statements.length} classified correctly`}
    >
      <p className="cp-prompt">{prompt}</p>
      <div className="cp-stack">
        {statements.map((statement) => {
          const answer = answers[statement.id];
          const stateClass =
            answer === undefined ? "" : answer === statement.isTrue ? "is-success" : "is-danger";
          return (
            <div className={`cp-inline-card ${stateClass}`} key={statement.id}>
              <div>
                <strong>{statement.text}</strong>
                {statement.explanation ? <p>{statement.explanation}</p> : null}
              </div>
              <div className="cp-chip-row">
                <button
                  className={`cp-chip-button ${answer === true ? "is-active" : ""}`}
                  onClick={() => setAnswers((current) => ({ ...current, [statement.id]: true }))}
                  type="button"
                >
                  True
                </button>
                <button
                  className={`cp-chip-button ${answer === false ? "is-active" : ""}`}
                  onClick={() =>
                    setAnswers((current) => ({ ...current, [statement.id]: false }))
                  }
                  type="button"
                >
                  False
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </PlayerCard>
  );
}

export function InteractiveBlockRenderer({ block }: BlockRendererProps) {
  switch (block.type) {
    case "tile-match":
      return <TileMatchBlock block={block} />;
    case "category-sort":
      return <CategorySortBlock block={block} />;
    case "sequence-sorter":
      return <SequenceSorterBlock block={block} />;
    case "interactive-diagram":
      return <InteractiveDiagramBlock block={block} />;
    case "syntax-sprint":
      return <SyntaxSprintBlock block={block} />;
    case "binary-blitz":
      return <BinaryBlitzBlock block={block} />;
  }
}

export function CurriculumPlayer({ blocks }: CurriculumPlayerProps) {
  const [index, setIndex] = useState(0);
  const block = blocks[index];

  if (!block) {
    return (
      <PlayerCard eyebrow="Curriculum" title="No blocks yet">
        <p className="cp-empty-copy">Add an interactive block to start building the lesson flow.</p>
      </PlayerCard>
    );
  }

  return (
    <section className="cp-player">
      <InteractiveBlockRenderer block={block} />
      <div className="cp-player-controls">
        <button
          className="cp-chip-button"
          disabled={index === 0}
          onClick={() => setIndex((current) => Math.max(current - 1, 0))}
          type="button"
        >
          Previous
        </button>
        <span className="cp-player-progress">
          Block {index + 1} of {blocks.length}
        </span>
        <button
          className="cp-chip-button is-active"
          disabled={index === blocks.length - 1}
          onClick={() => setIndex((current) => Math.min(current + 1, blocks.length - 1))}
          type="button"
        >
          Next
        </button>
      </div>
    </section>
  );
}

export * from "./types";
