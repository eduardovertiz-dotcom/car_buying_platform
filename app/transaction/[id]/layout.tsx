import { TransactionProvider } from "@/context/TransactionContext";

type Props = {
  children: React.ReactNode;
  params: { id: string };
};

export default function TransactionLayout({ children, params }: Props) {
  return (
    <TransactionProvider transactionId={params.id}>
      <div className="min-h-screen flex flex-col">{children}</div>
    </TransactionProvider>
  );
}
