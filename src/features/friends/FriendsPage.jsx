import { useState } from 'react'
import { useFriendStore } from './useFriendStore.js'

function FriendAvatar({ name, index = 0 }) {
  return <span className={`friend-avatar friend-avatar--${(index % 3) + 1}`} aria-hidden="true">{name?.slice(0, 1) ?? '?'}</span>
}

function EmptyState({ children }) {
  return <p className="friend-empty-state">{children}</p>
}

function FriendsPage({ authUser, onRoomInvitationAccepted }) {
  const store = useFriendStore(authUser)
  const [codeInput, setCodeInput] = useState('')
  const [copyStatus, setCopyStatus] = useState('')

  const search = async (event) => {
    event.preventDefault()
    await store.actions.searchByCode(codeInput)
  }

  const copyCode = async () => {
    if (!store.code) return
    try {
      await navigator.clipboard.writeText(store.code)
      setCopyStatus('친구 코드를 복사했어요.')
    } catch {
      setCopyStatus('복사가 되지 않았어요. 코드를 길게 눌러 복사해 주세요.')
    }
  }

  const sendRequest = async () => {
    if (!store.searchResult) return
    await store.actions.sendRequest(store.searchResult.id)
  }

  const acceptRoomInvitation = async (invitation) => {
    const result = await store.actions.acceptRoomInvitation(invitation.id)
    if (!result.error) await onRoomInvitationAccepted?.()
  }

  if (store.loading) {
    return <section className="page-section friends-page" aria-labelledby="friends-heading">
      <p className="section-kicker">YOUR CREW</p>
      <h1 className="page-title" id="friends-heading">친구목록</h1>
      <p className="friend-loading" role="status">친구목록을 불러오고 있어요.</p>
    </section>
  }

  return <section className="page-section friends-page" aria-labelledby="friends-heading">
    <p className="section-kicker">YOUR CREW</p>
    <h1 className="page-title" id="friends-heading">친구목록</h1>
    <p className="page-description">친구 코드로 함께 운동할 사람을 찾아요.</p>

    {store.error && <div className="friend-sync-error" role="alert">{store.error}<button type="button" onClick={store.actions.loadAll}>다시 시도</button></div>}

    <section className="my-friend-code-card" aria-labelledby="my-friend-code-heading">
      <div>
        <p className="section-kicker">MY FRIEND CODE</p>
        <h2 id="my-friend-code-heading">{store.code ?? '친구 코드 없음'}</h2>
        <p>친구에게 이 코드를 알려주면 나를 찾을 수 있어요.</p>
      </div>
      <button className="secondary-action" disabled={!store.code} type="button" onClick={copyCode}>코드 복사</button>
      {copyStatus && <span className="friend-action-status" role="status">{copyStatus}</span>}
    </section>

    <section className="friend-search-section" aria-labelledby="friend-search-heading">
      <div className="friend-section-heading"><div><p className="section-kicker">ADD A FRIEND</p><h2 id="friend-search-heading">친구 찾기</h2></div></div>
      <form className="friend-search-form" noValidate onSubmit={search}>
        <label className="visually-hidden" htmlFor="friend-code">친구 코드</label>
        <input
          className="text-field"
          id="friend-code"
          maxLength="9"
          placeholder="예: DG-AB7K2M"
          value={codeInput}
          onChange={(event) => setCodeInput(event.target.value.toUpperCase())}
        />
        <button className="home-button" disabled={store.searchLoading || store.saving} type="submit">{store.searchLoading ? '찾는 중…' : '검색'}</button>
      </form>
      {store.searchError && <p className="field-error" role="alert">{store.searchError}</p>}
      {store.searchResult && <div className="friend-search-result">
        <FriendAvatar name={store.searchResult.name} />
        <span className="friend-name">{store.searchResult.name}</span>
        <button className="secondary-action" disabled={store.saving} type="button" onClick={sendRequest}>{store.saving ? '처리 중…' : '친구 요청'}</button>
      </div>}
    </section>

    <section className="friend-list-section" aria-labelledby="friend-requests-heading">
      <div className="friend-section-heading"><div><p className="section-kicker">REQUESTS FOR YOU</p><h2 id="friend-requests-heading">받은 요청 <span>{store.requests.incoming.length}</span></h2></div></div>
      {store.requests.incoming.length === 0 ? <EmptyState>새로 받은 친구 요청이 없어요.</EmptyState> : <ul className="friend-list">
        {store.requests.incoming.map((request, index) => <li className="friend-item" key={request.id}>
          <FriendAvatar index={index} name={request.name} />
          <span className="friend-name">{request.name}</span>
          <span className="friend-item-actions"><button className="friend-inline-button friend-inline-button--accept" disabled={store.saving} type="button" onClick={() => store.actions.respondRequest(request.id, 'accept')}>수락</button><button className="friend-inline-button" disabled={store.saving} type="button" onClick={() => store.actions.respondRequest(request.id, 'reject')}>거절</button></span>
        </li>)}
      </ul>}
    </section>

    <section className="friend-list-section" aria-labelledby="sent-requests-heading">
      <div className="friend-section-heading"><div><p className="section-kicker">WAITING FOR REPLY</p><h2 id="sent-requests-heading">보낸 요청 <span>{store.requests.outgoing.length}</span></h2></div></div>
      {store.requests.outgoing.length === 0 ? <EmptyState>보낸 친구 요청이 없어요.</EmptyState> : <ul className="friend-list">
        {store.requests.outgoing.map((request, index) => <li className="friend-item" key={request.id}>
          <FriendAvatar index={index} name={request.name} />
          <span className="friend-name">{request.name}</span>
          <span className="friend-item-actions"><span className="friend-status">응답 대기</span><button className="friend-inline-button" disabled={store.saving} type="button" onClick={() => store.actions.cancelRequest(request.id)}>취소</button></span>
        </li>)}
      </ul>}
    </section>

    <section className="friend-list-section" aria-labelledby="room-invitations-heading">
      <div className="friend-section-heading"><div><p className="section-kicker">ROOM INVITATIONS</p><h2 id="room-invitations-heading">받은 운동방 초대 <span>{store.roomInvitations.length}</span></h2></div></div>
      {store.roomInvitations.length === 0 ? <EmptyState>새로 받은 운동방 초대가 없어요.</EmptyState> : <ul className="friend-list room-invitation-list">
        {store.roomInvitations.map((invitation) => <li className="friend-item room-invitation-item" key={invitation.id}>
          <span className={`room-invitation-symbol room-card__art--${invitation.roomColor}`} aria-hidden="true">{invitation.roomSymbol}</span>
          <span className="room-invitation-copy"><b>{invitation.roomName}</b><small>{invitation.inviterName}님이 초대했어요.</small></span>
          <span className="friend-item-actions"><button className="friend-inline-button friend-inline-button--accept" disabled={store.saving} type="button" onClick={() => acceptRoomInvitation(invitation)}>수락</button><button className="friend-inline-button" disabled={store.saving} type="button" onClick={() => store.actions.rejectRoomInvitation(invitation.id)}>거절</button></span>
        </li>)}
      </ul>}
    </section>

    <section className="friend-list-section" aria-labelledby="accepted-friends-heading">
      <div className="friend-section-heading"><div><p className="section-kicker">YOUR FRIENDS</p><h2 id="accepted-friends-heading">친구 <span>{store.friends.length}</span></h2></div></div>
      {store.friends.length === 0 ? <EmptyState>아직 친구가 없어요. 친구 코드로 찾아보세요.</EmptyState> : <ul className="friend-list">
        {store.friends.map((friend, index) => <li className="friend-item" key={friend.id}>
          <FriendAvatar index={index} name={friend.name} />
          <span className="friend-name">{friend.name}</span>
          <span className="friend-item-actions"><span className="friend-status">운동 친구</span><button className="friend-inline-button" disabled={store.saving} type="button" onClick={() => store.actions.removeFriend(friend.id)}>삭제</button></span>
        </li>)}
      </ul>}
    </section>
  </section>
}

export default FriendsPage
