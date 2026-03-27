import { type Result } from './result';

export class ResultPipeline<T, E> {
  constructor(private readonly result: Result<T, E>) {}

  andThen<U, F>(fn: (value: T) => Result<U, F>): ResultPipeline<U, E | F> {
    if (!this.result.ok) {
      return new ResultPipeline<U, E | F>(this.result);
    }

    return new ResultPipeline<U, E | F>(fn(this.result.value));
  }

  done(): Result<T, E> {
    return this.result;
  }
}
