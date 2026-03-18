interface ShortcutHelpProps {
  onClose: () => void
}

const shortcuts = [
  ['Playback', [
    ['space', 'Play / pause'],
    ['n', 'Next track'],
    ['p', 'Previous track'],
    ['m', 'Mute / unmute'],
  ]],
  ['Navigation', [
    ['1', 'Library'],
    ['2', 'Add Music'],
    ['3', 'Queue'],
    ['s', 'Search'],
  ]],
  ['Other', [
    ['?', 'This menu'],
    ['esc', 'Close / cancel'],
  ]],
] as const

export default function ShortcutHelp({ onClose }: ShortcutHelpProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface-2 rounded-2xl p-6 w-[400px] max-w-[90vw] shadow-2xl border border-white/5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold mb-5">Keyboard Shortcuts</h2>
        {shortcuts.map(([section, keys]) => (
          <div key={section} className="mb-4 last:mb-0">
            <h3 className="text-[11px] text-white/40 uppercase tracking-wider font-medium mb-2">
              {section}
            </h3>
            <div className="space-y-1.5">
              {keys.map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-[13px] text-white/70">{desc}</span>
                  <kbd className="text-[11px] text-white/50 bg-surface-4 px-2 py-0.5 rounded font-mono min-w-[28px] text-center">
                    {key}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
