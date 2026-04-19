import React from 'react';

type SceneBibleSummaryProps = {
  characterBible?: any;
  worldBible?: any;
};

export function SceneBibleSummary({ characterBible, worldBible }: SceneBibleSummaryProps) {
  if (!characterBible && !worldBible) return null;

  return (
    <div className="mb-4 grid gap-3 lg:grid-cols-2">
      {characterBible && (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-300">
          <div className="mb-2 font-semibold text-white">角色圣经</div>
          {(characterBible.mainCharacters || []).map((character: any) => (
            <div key={character.id || character.name} className="mb-2 rounded-xl border border-white/6 bg-white/[0.03] p-2 last:mb-0">
              <div className="font-medium text-white">{character.name}</div>
              <div className="mt-1">{character.appearance}</div>
              <div className="mt-1 text-neutral-500">{character.outfit}</div>
            </div>
          ))}
        </div>
      )}
      {worldBible && (
        <div className="rounded-2xl border border-white/10 bg-black/30 p-3 text-xs text-neutral-300">
          <div className="mb-2 font-semibold text-white">世界圣经</div>
          <div>{worldBible.environmentStyle}</div>
          {Array.isArray(worldBible.colorPalette) && worldBible.colorPalette.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {worldBible.colorPalette.map((color: string) => (
                <span key={color} className="rounded-full border border-white/10 bg-white/6 px-2 py-0.5">
                  {color}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
