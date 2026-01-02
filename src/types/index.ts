// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Ctor<T> = new (...args: Array<any>) => T;

export interface Controller<Props = unknown, State = unknown> {
  props: Props;
  state: State;
  setState<S = State>(state: S | ((prevState: S) => S)): void;
  forceUpdate(): void;
}

export type InjectableParams = {
  providedIn: 'root';
};

export type ComponentParams = {
  selector: string;
  providers?: Array<Ctor<unknown>>;
};

export type RouterParams = {
  selector: string;
  components: Array<Ctor<unknown> | React.FC>;
  providers?: Array<Ctor<unknown>>;
};

export interface IoComponent<Props = unknown, State = unknown> {
  state?: State;
  componentDidMount?(): void;
  componentDidUpdate?(prevProps: Props, prevState: State): void;
  componentWillUnmount?(): void;
  render(): React.ReactNode;
}

export type ComponentWrapperProps = Record<string, unknown>;

export type ComponentWrapperState = Record<string, unknown>;

export type RouterWrapperProps = Record<string, unknown>;

export type RouterWrapperState = Record<string, unknown>;
