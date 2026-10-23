export const rooms = [
  {
    id: 'after-work',
    name: '퇴근 후 헬스',
    members: [
      { id: 'member-lee-jihoon', name: '이지훈' },
      { id: 'member-kim-minsu', name: '김민수' },
      { id: 'member-park-seoyeon', name: '박서연' },
      { id: 'member-choi-yujin', name: '최유진' },
    ],
    exercises: ['벤치프레스', '스쿼트'],
    color: 'peach',
    symbol: '💪',
  },
  {
    id: 'weekend',
    name: '주말 운동팟',
    members: [
      { id: 'member-lee-jihoon', name: '이지훈' },
      { id: 'member-kim-minsu', name: '김민수' },
      { id: 'member-park-seoyeon', name: '박서연' },
    ],
    exercises: [],
    color: 'lavender',
    symbol: '🏋️',
  },
  {
    id: 'solo',
    name: '나 혼자 운동',
    members: [{ id: 'member-kim-minsu', name: '김민수' }],
    exercises: ['랫풀다운'],
    color: 'mint',
    symbol: '🧘',
  },
]

export const currentUserId = 'member-kim-minsu'
