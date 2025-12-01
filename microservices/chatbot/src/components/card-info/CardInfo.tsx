import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface CardProps extends React.ComponentProps<typeof Card> { // Definisce le proprietà del componente CardInfo
  title: string;
  icon: React.ReactNode;
  data: string;
  description?: string;
  info?: string;
}

export function CardInfo({
  title,
  icon,
  description,
  data,
  info,
  className,
  ...props
}: CardProps) {
  return (
    <Card className={cn(className)} {...props}>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <div>{title}</div>
          <div>{icon}</div>
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>
        <p className="font-semibold text-2xl">{data}</p>
        {info && <p className="pt-2 font-semibold text-sm text-gray-400">{info}</p>}
      </CardContent>
    </Card>
  );
}
