"use client"; // Next.js 13 app dir ke liye, agar simple CRA ya Vite hai toh hata sakte ho
import React from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ChecklistFormValues } from "./checklistSchema";
import { checklistSchema } from "./checklistSchema";
import { useMutation } from "@tanstack/react-query";
import axios from "axios";

// shadcn components
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2, Plus } from "lucide-react";

const CheckList = () => {
  // ---------------------- Form Setup ----------------------
  const form = useForm<ChecklistFormValues>({
    resolver: zodResolver(checklistSchema),
    defaultValues: {
      title: "My Checklist",
      items: [
        { id: 1, label: "Item 1", checked: false },
        { id: 2, label: "Item 2", checked: false },
        { id: 3, label: "Item 3", checked: false },
        { id: 4, label: "Item 4", checked: false },
        { id: 5, label: "Item 5", checked: false },
      ],
    },
  });

  const { control, register, watch, setValue } = form;

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "items",
  });

  // ---------------------- Backend Mutation ----------------------
  const updateChecklistItem = useMutation({
    mutationFn: (payload: { id: number; checked: boolean }) =>
      axios.patch("/api/checklist/item", payload),
    onError: () => {
      // alert("Failed to update item!");
    },
  });

  // ---------------------- Percentage Calculation ----------------------
  const items = watch("items");
  const checkedCount = items.filter((i) => i.checked).length;
  const percentage = checkedCount * 10; // each checkbox = 10%

  // ---------------------- Render ----------------------
  return (
    <Card className="max-w-lg mx-auto mt-6">
      {/* Header with title + percentage badge */}
      <CardHeader className="flex justify-between items-center">
        <CardTitle>{form.getValues("title")}</CardTitle>
        <Badge>{percentage}%</Badge>
      </CardHeader>

      {/* Progress bar */}
      <CardContent className="space-y-3">
        <Progress value={percentage} />

        {/* Checklist Items */}
        {fields.map((field, index) => (
          <div key={field.id} className="flex items-center gap-3">
            <Checkbox
              checked={field.checked}
              onCheckedChange={(value) => {
                // Update UI immediately
                update(index, { ...field, checked: Boolean(value) });
                // Send backend update
                updateChecklistItem.mutate({ id: field.id, checked: Boolean(value) });
              }}
            />
            <Input
              {...register(`items.${index}.label`)}
              placeholder="Checklist item"
            />
            <Button
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}

        {/* Add new item button */}
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          onClick={() =>
            append({ id: Date.now(), label: `Item ${fields.length + 1}`, checked: false })
          }
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Item
        </Button>
      </CardContent>
    </Card>
  );
};

export default CheckList;
