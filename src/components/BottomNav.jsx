const menuItems = [
  { id: 'home', label: '운동방', icon: '⌂' },
  { id: 'friends', label: '친구목록', icon: '♧' },
  { id: 'create', label: '방 만들기', icon: '+' },
  { id: 'stats', label: '통계', icon: '▤' },
  { id: 'settings', label: '설정', icon: '⚙︎' },
]

function BottomNav({ activeScreen, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="하단 메뉴">
      {menuItems.map((item) => (
        <button
          className={`bottom-nav__item${activeScreen === item.id ? ' is-active' : ''}${item.id === 'create' ? ' bottom-nav__item--create' : ''}`}
          key={item.id}
          type="button"
          onClick={() => onNavigate(item.id)}
          aria-current={activeScreen === item.id ? 'page' : undefined}
        >
          <span className={`bottom-nav__icon bottom-nav__icon--${item.id}`} aria-hidden="true">
            {item.icon}
          </span>
          <span className="bottom-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  )
}

export default BottomNav
