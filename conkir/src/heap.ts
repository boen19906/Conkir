/* Flat Binary Heap — direct port of OpenFront's FlatBinaryHeap.ts
   Min-heap: lowest priority number = dequeued first.
   Uses parallel typed arrays for cache efficiency. */
export class FlatBinaryHeap {
  pri: Float32Array;
  vals: Int32Array;
  len: number;

  constructor(capacity = 1024) {
    this.pri = new Float32Array(capacity);
    this.vals = new Int32Array(capacity);
    this.len = 0;
  }

  clear() { this.len = 0; }
  size() { return this.len; }

  enqueue(val: number, priority: number) {
    if (this.len === this.pri.length) this._grow();
    let i = this.len++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (priority >= this.pri[p]) break;
      this.pri[i] = this.pri[p]; this.vals[i] = this.vals[p];
      i = p;
    }
    this.pri[i] = priority; this.vals[i] = val;
  }

  dequeue(): number | null {
    if (this.len === 0) return null;
    const topVal = this.vals[0];
    const lastPri = this.pri[--this.len];
    const lastVal = this.vals[this.len];
    let i = 0;
    while (true) {
      const l = (i << 1) + 1; if (l >= this.len) break;
      const r = l + 1;
      const c = (r < this.len && this.pri[r] < this.pri[l]) ? r : l;
      if (lastPri <= this.pri[c]) break;
      this.pri[i] = this.pri[c]; this.vals[i] = this.vals[c];
      i = c;
    }
    this.pri[i] = lastPri; this.vals[i] = lastVal;
    return topVal;
  }

  _grow() {
    const nc = this.pri.length << 1;
    const np = new Float32Array(nc); np.set(this.pri); this.pri = np;
    const nv = new Int32Array(nc); nv.set(this.vals); this.vals = nv;
  }
}
