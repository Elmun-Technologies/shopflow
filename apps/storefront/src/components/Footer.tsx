interface Props {
  tenantTitle: string;
}

export function Footer({ tenantTitle }: Props) {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8 text-center text-sm text-neutral-500">
        © {new Date().getFullYear()} {tenantTitle} · ShopFlow asosida
      </div>
    </footer>
  );
}
