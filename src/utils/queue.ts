/**
 * 排队锁
 *
 * @example
 * const queue = new LockQueue();
 *
 * const fn = async () => {
 *  // 等待前面的队列释放
 *  const release = await queue.waitInQueue();
 *
 *  await yourCode();
 *
 *  // 释放队列
 *  release();
 * };
 *
 * fn();
 * fn();
 * fn();
 */
export class LockQueue {
	queue: Promise<any>;

	constructor() {
		this.queue = Promise.resolve();
	}

	waitInQueue() {
		let _resolve: (value?: any) => void;

		const nextPromise = new Promise((resolve) => {
			_resolve = resolve;
		});

		// 等待上一个 Promise 完成，然后运行当前 Promise
		const currentWait = this.queue.then(() => _resolve);
		// 把当前 Promise 推入队列
		this.queue = nextPromise;

		return currentWait;
	}
}
