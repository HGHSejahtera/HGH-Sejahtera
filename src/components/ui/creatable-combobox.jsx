import * as React from "react"
import { Check, ChevronsUpDown, Plus } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function CreatableCombobox({ 
  options = [], 
  value, 
  onChange, 
  placeholder = "Select", 
  emptyMessage = "No matching items.",
  id
}) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  // Check if exactly matches an existing option
  const exactMatch = options.find((opt) => opt.toLowerCase() === inputValue.toLowerCase())
  const showCreate = inputValue.trim().length > 0 && !exactMatch

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-full justify-between bg-gray-50/50 hover:bg-white text-left font-normal border-gray-200",
            !value && "text-muted-foreground"
          )}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-lg" align="start">
        <Command>
          <CommandInput 
            placeholder="Search" 
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            <CommandEmpty>
              {showCreate ? (
                 <div className="p-1">
                   <Button 
                      variant="ghost" 
                      className="w-full justify-start text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 font-medium"
                      onClick={() => {
                        onChange(inputValue.trim())
                        setOpen(false)
                        setInputValue("")
                      }}
                   >
                     <Plus className="mr-2 h-4 w-4" />
                     Create "{inputValue.trim()}"
                   </Button>
                 </div>
              ) : (
                 <div className="py-6 text-center text-sm text-gray-500">
                    {emptyMessage}
                 </div>
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option}
                  value={option}
                  onSelect={() => {
                    onChange(option)
                    setOpen(false)
                    setInputValue("")
                  }}
                  className="cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 text-indigo-600",
                      value === option ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option}
                </CommandItem>
              ))}
              
              {/* Show Create button inside group if there are matches but no exact match */}
              {showCreate && options.length > 0 && options.some(opt => opt.toLowerCase().includes(inputValue.toLowerCase())) && (
                <CommandItem
                  value={`create_${inputValue}`}
                  onSelect={() => {
                    onChange(inputValue.trim())
                    setOpen(false)
                    setInputValue("")
                  }}
                  className="border-t border-gray-100 mt-1 font-medium text-indigo-600 cursor-pointer"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create "{inputValue.trim()}"
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
