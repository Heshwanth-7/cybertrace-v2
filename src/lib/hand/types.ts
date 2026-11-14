export interface Point {
  x: number;
  y: number;
}

export interface Landmark extends Point {
  z: number;
}

export interface GestureState {
  drawing: boolean;
  erasing: boolean;
  enterCount: number;
  exitCount: number;
}
