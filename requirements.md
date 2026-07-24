# Kazhutha (Donkey) - Web App Requirements

## Overview

Create a browser-based multiplayer implementation of the Kerala card game **Kazhutha (Donkey)**.

Primary goal:
- Fast, lightweight.
- Play only with friends.
- No accounts required.
- Works on desktop and mobile.
- Supports LAN and Internet play.

Architecture should prefer **peer-to-peer** to minimize server costs while keeping latency low. Since this is intended for trusted friends rather than competitive matchmaking, minor client-side trust issues are acceptable.

---

# Goals

- Faithful implementation of traditional Kerala rules.
- Extremely simple onboarding.
- Zero-install.
- Share room link and play.
- Responsive UI.
- Minimal hosting cost.
- Offline-capable after initial load (PWA desirable).

---

# Non Goals

- Public matchmaking.
- Ranking.
- Competitive anti-cheat.
- Real-money gameplay.
- Complex social features.

---

# Architecture

Preferred architecture:

```
Players
    │
 WebRTC Mesh
    │
Tracker / Signalling Server
```

Tracker responsibilities:

- Room discovery
- WebRTC signalling
- ICE exchange
- Relay SDP offers/answers
- No gameplay logic
- No game state persistence

Gameplay synchronization occurs directly between peers.

Possible technologies:

- WebRTC DataChannels
- WebTorrent trackers
- custom lightweight signalling server
- WebSocket signalling
- STUN servers
- TURN optional

---

## Fallback Architecture

If WebRTC proves unreliable:

```
Players
     │
 WebSocket
     │
 Authoritative Server
```

Game engine should be designed so networking layer can later switch from P2P to server-authoritative with minimal changes.

---

# Trust Model

Players are assumed to know each other.

Acceptable:

- Client distributes cards.
- Client validates moves.
- Honest majority.

Not required:

- Cheat prevention.
- Hidden card cryptography.
- Secure shuffle proofs.

However architecture should isolate game logic enough that secure dealing could be added later.

---

# Functional Requirements

## Create Room

Host can:

- Create room
- Receive room code
- Receive shareable URL
- Configure settings
- Start game

Example:

```
kazhutha.app/ABCD1234
```

---

## Join Room

Player can:

- Enter room code
- Open invite link
- Enter nickname
- Join lobby

---

## Lobby

Display:

- Players
- Host
- Ready state
- Connection quality
- Ping (optional)

Host can:

- Kick player
- Start game
- Change rules

---

# Game Rules

## Deck

Standard 52-card deck.

No jokers.

---

## Ranking

```
A
K
Q
J
10
9
8
7
6
5
4
3
2
```

Ace highest.

---

## Dealing

Shuffle.

Deal all cards as evenly as possible.

Some players may receive one additional card.

---

## First Round

Player holding Ace of Spades starts.

Optional rule:

Host may choose:

- Must lead Ace of Spades
- May lead any card

---

## Turn Order

Fixed throughout game.

Only round leader changes.

---

## Normal Round

Leader plays any card.

Each following player:

- must follow suit if available

If everyone follows:

- discard cards
- highest card wins round
- winner leads next round

---

## Vettu

If player lacks suit:

Player may play any card.

Immediately:

- round ends
- remaining players skipped
- all played cards collected
- collector is highest lead-suit card currently played
- collector starts next round

---

## Player Exit

Player exits only when:

- last card played
- round finishes normally
- no vettu occurred

If player plays last card but later receives vettu:

Player collects cards.

Player remains in game.

---

## End Game

Continue until one player still has cards.

That player becomes:

"Kazhutha"

---

# Rule Variants

Host can enable:

- Must open with Ace of Spades
- Ace holder may lead anything
- Custom card ranking
- Jokers
- Future variants

Rules should be modular.

---

# Synchronization

Every action should be represented as events.

Example:

```
RoomCreated

PlayerJoined

GameStarted

CardsShuffled

CardsDealt

CardPlayed

RoundFinished

VettuOccurred

CardsCollected

PlayerExited

GameFinished
```

Entire game should be replayable by applying events.

---

# Reconnection

If player disconnects briefly:

- reconnect automatically
- synchronize missing events
- continue

If impossible:

Host decides:

- continue
- restart

---

# State Model

Track:

- players
- hand
- discarded cards
- collected cards
- current leader
- current turn
- lead suit
- current highest card
- active players
- finished players
- event history

---

# User Interface

## Lobby

- Player list
- Invite button
- Copy room link
- Ready button
- Start button

---

## Game Screen

Display:

Own cards

Center pile

Current leader

Current turn

Remaining cards per player

Players already finished

Animations:

- card play
- vettu
- card collection
- player exit

---

## Mobile

Portrait preferred.

Hand fans naturally.

Large touch targets.

---

## Desktop

Resizable.

Keyboard shortcuts optional.

---

# Card Interactions

Tap:

Select card.

Tap again:

Play.

Illegal plays should be impossible.

Client should only allow legal cards.

---

# UX

Fast animations.

No unnecessary dialogs.

One-tap gameplay.

Visual emphasis on:

- whose turn
- lead suit
- vettu
- player collecting cards
- player finishing

---

# Sound

Optional.

Effects:

- card play
- shuffle
- vettu
- collection
- finish

Mute supported.

---

# Networking

Support:

- 2–8 players (minimum)
- Ideally up to 10 players

Bandwidth should remain low.

Messages should contain only game events.

---

# Performance

Game should remain smooth on:

- Android Chrome
- iPhone Safari
- Desktop browsers

---

# PWA

Preferred.

Features:

- Installable
- Offline assets
- Resume quickly

---

# Security

Basic only.

Prevent:

- malformed packets
- invalid moves
- duplicated events

Do not optimize for determined cheating.

---

# Accessibility

- Colorblind-safe suits
- Large text option
- High contrast mode
- Reduced motion option

---

# Future Features

- Spectator mode
- Replay
- Statistics
- AI player
- Tournament mode
- Rule presets
- Voice chat
- Emoji reactions
- Chat
- QR code room joining

---

# Technical Suggestions

Frontend

- React
- Next.js
- TypeScript
- Tailwind
- Framer Motion

Networking

- WebRTC DataChannels
- simple-peer
- WebTorrent tracker or custom signalling

Game Engine

Pure deterministic state machine.

UI never contains game logic.

Networking layer submits events to engine.

Renderer observes engine state.

---

# Recommended Project Structure

```
/game
    rules
    engine
    events
    reducers
    validators

/network
    webrtc
    websocket
    signalling

/ui
    components
    animations
    screens

/shared
    cards
    deck
    types
    utils
```

---

# Nice-to-have

- QR room join
- Deep links
- Share API
- Copy invite link
- Animated shuffle
- Animated vettu
- Replay entire game from event log
- Export replay JSON
- Seeded shuffle for debugging
- Developer event timeline
