export const Loading = (): JSX.Element => {
  return (
    <main className="flex flex-col justify-center items-center h-dvh">
      <img src="/favicon.svg" className="w-20" />
      <span className="loading loading-spinner w-5" />
    </main>
  );
};
