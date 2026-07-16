import { cn } from "@/lib/utils"
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    getFilteredRowModel,
} from "@tanstack/react-table"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { Settings2 } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"

export function DataTable({ 
    columns, 
    data, 
    searchPlaceholder = "Search", 
    actionElement,
    rowSelection = {},
    onRowSelectionChange,
    columnVisibility: externalColumnVisibility,
    onColumnVisibilityChange: externalOnColumnVisibilityChange,
    tableContainerClassName = "max-h-[calc(100vh-220px)] overflow-auto",
    defaultPageSize = 100
}) {
    const [globalFilter, setGlobalFilter] = useState("")
    const [internalColumnVisibility, setInternalColumnVisibility] = useState({})
    const [sorting, setSorting] = useState([])
    const [visibleLimit, setVisibleLimit] = useState(100)

    const columnVisibility = externalColumnVisibility !== undefined ? externalColumnVisibility : internalColumnVisibility;
    const setColumnVisibility = externalOnColumnVisibilityChange || setInternalColumnVisibility;

    // eslint-disable-next-line react-hooks/incompatible-library
    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        onColumnVisibilityChange: setColumnVisibility,
        onSortingChange: setSorting,
        onRowSelectionChange: onRowSelectionChange,
        enableRowSelection: true,
        state: {
            globalFilter,
            columnVisibility,
            sorting,
            rowSelection,
        },
        initialState: {
            pagination: {
                pageSize: defaultPageSize,
            },
        },
        onGlobalFilterChange: (value) => {
            setGlobalFilter(value);
            setVisibleLimit(100);
        },
    })

    return (
        <div className="w-full space-y-4">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4 flex-1 flex-wrap">
                    <Input
                        placeholder={searchPlaceholder}
                        value={globalFilter ?? ""}
                        onChange={(event) => setGlobalFilter(String(event.target.value))}
                        className="max-w-sm h-8 text-xs rounded-md border-gray-200 shadow-xs focus:border-indigo-500"
                    />
                    <div className="flex items-center space-x-1.5 text-xs text-gray-500">
                        <span className="font-medium whitespace-nowrap">Show</span>
                        <Select
                            value={`${table.getState().pagination.pageSize}`}
                            onValueChange={(value) => {
                                table.setPageSize(Number(value))
                            }}
                        >
                            <SelectTrigger className="h-8 w-[80px] bg-white text-xs font-medium rounded-md border-gray-200 shadow-xs">
                                <SelectValue placeholder={table.getState().pagination.pageSize === 999999 ? 'All' : table.getState().pagination.pageSize} />
                            </SelectTrigger>
                            <SelectContent side="bottom" className="rounded-md shadow-lg border-gray-200 text-xs">
                                {[10, 30, 50, 100].map((pageSize) => (
                                    <SelectItem key={pageSize} value={`${pageSize}`}>
                                        {pageSize}
                                    </SelectItem>
                                ))}
                                <SelectItem value="999999">All</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {actionElement && (
                        <div>
                            {actionElement}
                        </div>
                    )}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="ml-auto hidden h-8 px-3 text-xs font-medium rounded-md border-gray-200 lg:flex shadow-xs text-gray-700 hover:bg-gray-50 cursor-pointer">
                                <Settings2 className="mr-1.5 h-3.5 w-3.5 text-gray-500" />
                                View
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                            {table
                                .getAllColumns()
                                .filter((column) => column.getCanHide() && column.id !== "Actions")
                                .map((column) => {
                                    return (
                                        <DropdownMenuCheckboxItem
                                            key={column.id}
                                            className="capitalize"
                                            checked={column.getIsVisible()}
                                            onCheckedChange={(value) => column.toggleVisibility(!!value)}
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            {typeof column.columnDef.header === 'string' ? column.columnDef.header : column.id}
                                        </DropdownMenuCheckboxItem>
                                    )
                                })}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>
            <Table containerClassName={cn("rounded-md border relative", tableContainerClassName)}>
                <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => {
                                    return (
                                        <TableHead key={header.id} className={header.column.columnDef.meta?.className}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                    header.column.columnDef.header,
                                                    header.getContext()
                                                )}
                                        </TableHead>
                                    )
                                })}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {(table.getState().pagination.pageSize === 999999 ? table.getRowModel().rows.slice(0, visibleLimit) : table.getRowModel().rows)?.length ? (
                            (table.getState().pagination.pageSize === 999999 ? table.getRowModel().rows.slice(0, visibleLimit) : table.getRowModel().rows).map((row) => (
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={columns.length} className="h-24 text-center">
                                    No results.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
            </Table>
            {table.getState().pagination.pageSize === 999999 && table.getRowModel().rows.length > visibleLimit && (
                <div className="flex justify-center py-3 border-t border-gray-100 bg-gray-50/60 rounded-b-md">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setVisibleLimit((prev) => prev + 100)}
                        className="bg-white hover:bg-gray-100 text-gray-800 font-semibold text-xs px-5 h-8 rounded-md border-gray-300 shadow-xs transition-all cursor-pointer"
                    >
                        Load More Orders (Showing {visibleLimit} of {table.getRowModel().rows.length})
                    </Button>
                </div>
            )}
            {table.getState().pagination.pageSize === 999999 && table.getRowModel().rows.length > 100 && table.getRowModel().rows.length <= visibleLimit && (
                <div className="flex justify-center py-2 border-t border-gray-100 bg-emerald-50/60 rounded-b-md text-emerald-700 text-xs font-medium">
                    ✓ All {table.getRowModel().rows.length} entries loaded and displayed
                </div>
            )}
            <div className="flex items-center justify-between px-2">
                <div className="flex-1 text-sm text-muted-foreground">
                    {table.getFilteredSelectedRowModel().rows.length > 0 ? (
                        <span>
                            {table.getFilteredSelectedRowModel().rows.length} of{" "}
                            {table.getFilteredRowModel().rows.length} row(s) selected.
                        </span>
                    ) : (
                        <span>
                            {table.getState().pagination.pageSize === 999999 ? (
                                `Showing 1 to ${Math.min(visibleLimit, table.getRowModel().rows.length)} of ${table.getRowModel().rows.length} entries`
                            ) : (
                                `Showing ${table.getFilteredRowModel().rows.length > 0 ? table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1 : 0} to ${Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} of ${table.getFilteredRowModel().rows.length} entries`
                            )}
                        </span>
                    )}
                </div>
                {table.getState().pagination.pageSize !== 999999 && (
                    <div className="flex items-center space-x-6 lg:space-x-8">
                        <div className="flex w-[100px] items-center justify-center text-sm font-medium text-gray-700">
                            Page {table.getState().pagination.pageIndex + 1} of{" "}
                            {table.getPageCount()}
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                className="hidden h-8 w-8 p-0 lg:flex"
                                onClick={() => table.setPageIndex(0)}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Go to first page</span>
                                <span className="h-4 w-4">{'<<'}</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => table.previousPage()}
                                disabled={!table.getCanPreviousPage()}
                            >
                                <span className="sr-only">Go to previous page</span>
                                <span className="h-4 w-4">{'<'}</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="h-8 w-8 p-0"
                                onClick={() => table.nextPage()}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Go to next page</span>
                                <span className="h-4 w-4">{'>'}</span>
                            </Button>
                            <Button
                                variant="outline"
                                className="hidden h-8 w-8 p-0 lg:flex"
                                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                                disabled={!table.getCanNextPage()}
                            >
                                <span className="sr-only">Go to last page</span>
                                <span className="h-4 w-4">{'>>'}</span>
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
