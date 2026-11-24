export const MOVEMENT_CAPABILITY = "movement-v1";
export function enableMovement(member) {
  member.moveState = { seq: 0, seconds: 0, epoch: 0 };
  member.movementAck = [0, 0, 0, 0];
}
export function acceptMovement(member, message) {
  const state = member.moveState;
  if (!state) return true; // Original protocol-4 intention path.
  if (
    !Number.isSafeInteger(message.seq) ||
    message.seq <= state.seq ||
    !Number.isFinite(message.x) ||
    !Number.isFinite(message.y)
  )
    return false;
  state.seq = message.seq;
  state.seconds = 0;
  return true;
}
export function neutralMovement(member) {
  if (member.moveState) {
    member.moveState.epoch++;
    member.moveState.seconds = 0;
  }
}
export function acknowledgeMovement(room, dt) {
  room.movementStep = (room.movementStep || 0) + 1;
  for (const member of room.members.values())
    if (member.moveState) {
      const s = member.moveState;
      s.seconds += Math.min(0.05, Math.max(0, dt));
      member.movementAck = [
        s.seq,
        Math.round(s.seconds * 1e6) / 1e6,
        room.movementStep,
        s.epoch,
      ];
    }
}
