import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type WorkerFormValues = {
  name: string;
  father_name: string;
  phone_number: string;
  aadhar_card: string;
  worker_type: string;
};

type WorkerFormFieldsProps = {
  values: WorkerFormValues;
  onChange: (values: WorkerFormValues) => void;
};

export function WorkerFormFields({ values, onChange }: WorkerFormFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="worker-name">Name</Label>
        <Input
          id="worker-name"
          value={values.name}
          onChange={(event) => onChange({ ...values, name: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="worker-father-name">FatherName</Label>
        <Input
          id="worker-father-name"
          value={values.father_name}
          onChange={(event) => onChange({ ...values, father_name: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="worker-phone">PhoneNumber</Label>
        <Input
          id="worker-phone"
          inputMode="numeric"
          maxLength={10}
          value={values.phone_number}
          onChange={(event) => onChange({ ...values, phone_number: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="worker-aadhar">AadharCard (optional)</Label>
        <Input
          id="worker-aadhar"
          value={values.aadhar_card}
          onChange={(event) => onChange({ ...values, aadhar_card: event.target.value })}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="worker-type">WorkerType (optional)</Label>
        <Input
          id="worker-type"
          value={values.worker_type}
          onChange={(event) => onChange({ ...values, worker_type: event.target.value })}
        />
      </div>
    </div>
  );
}
