'use client';

import { BellAlertIcon, DocumentCheckIcon, MagnifyingGlassIcon, UserCircleIcon } from '@heroicons/react/24/outline';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { Tooltip } from 'react-tooltip';

export default function SidebarMenu() {
    const [isOpen, setIsOpen] = useState(false);

    const toggleSidebar = () => {
        setIsOpen(!isOpen);
    };

    return (
        <div className='fixed w-full'>
            {!isOpen &&
                <button onClick={toggleSidebar} aria-label={isOpen ? "Close menu" : "Open menu"} className="flex flex-col items-center justify-center w-10 h-10 rounded bg-gray-800 lg:hidden m-4" >
                    <div className="w-6 h-1 bg-white rounded"></div>
                    <div className="w-6 h-1 bg-white rounded my-1"></div>
                    <div className="w-6 h-1 bg-white rounded"></div>
                </button>
            }

            {/* Sidebar */}
            <div className={`fixed top-0 left-0 lg:justify-between h-full w-64 bg-gray-800 text-white shadow-lg transform transition-transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 lg:static lg:h-auto lg:w-full lg:flex lg:pl-4`}>

                {/* Logo/Brand */}
                <div className="flex items-center justify-center lg:justify-start mt-4 lg:mt-0">
                    <Image
                        src="/logo.png"
                        alt="Logo"
                        width={100}
                        height={10}
                        className="w-100 h-10 lg:w-100 lg:h-10 mx-auto lg:mx-0"/>
                </div>

                {/* Close Button (Visible on mobile only) */}
                <button onClick={toggleSidebar} className="absolute top-4 right-4 text-white text-2xl lg:hidden"> &times; </button>

                {/* Sidebar Content */}
                <nav className="flex absolute mt-8 lg:mt-0 lg:ml-24">
                    <ul className="flex flex-col space-y-4 px-4 py-8 lg:py-0 lg:flex-row lg:space-y-0 lg:space-x-0">
                        <li>
                            <Link href="/" className="block px-4 py-1 lg:py-4 hover:bg-blue-600 active-menu">Home</Link>
                        </li>
                        <li>
                            <Link href="/client/requirement" className="block px-4 py-1 lg:py-4 hover:bg-blue-600">Requirement</Link>
                        </li>
                        <li>
                            <Link href="/client/pr" className="block px-4 py-1 lg:py-4 hover:bg-blue-600">Purchase Requisition</Link>
                        </li>
                        <li>
                            <Link href="/client/rfq" className="block px-4 py-1 lg:py-4 hover:bg-blue-600">RFQ</Link>
                        </li>
                        <li>
                            <Link href="/client/auction" className="block px-4 py-1 lg:py-4 hover:bg-blue-600">Auction</Link>
                        </li>
                        <li>
                            <Link href="/client/po" className="block px-4 py-1 lg:py-4 hover:bg-blue-600">Purchase Order</Link>
                        </li>
                    </ul>
                </nav>

                <ul className="flex items-center py-2 lg:py-0 bg-gray-900 my-2 lg:my-0 lg:bg-transparent ">
                    <li>
                        <Link href="/" className="block px-4 py-1 lg:py-4 hover:bg-blue-600" data-tooltip-content="Find Something" data-tooltip-id="Header-Find-Something">
                            <div className="relative">
                                <span className="absolute top-0 ml-3 text-xs bg-red-600 rounded-lg pl-2 pr-2 mt-[-5px]"></span>
                                <MagnifyingGlassIcon className="w-6 h-6" />
                            </div>
                        </Link>
                        <Tooltip id="Header-Find-Something" />
                    </li>
                    <li>
                        <Link href="/" className="block px-4 py-1 lg:py-4 hover:bg-blue-600" data-tooltip-content="Approvals" data-tooltip-id="Header-Approvals">
                            <div className="relative">
                                <span className="absolute top-0 ml-3 text-xs bg-red-600 rounded-lg pl-2 pr-2 mt-[-5px]"></span>
                                <DocumentCheckIcon className="w-6 h-6" />
                            </div>
                        </Link>
                        <Tooltip id="Header-Approvals" />
                    </li>
                    <li>
                        <Link href="/" className="block px-4 py-1 lg:py-4 hover:bg-blue-600" data-tooltip-content="Notifications" data-tooltip-id="Header-Notifications">
                            <div className="relative">
                                <span className="absolute top-0 ml-3 text-xs bg-red-600 rounded-lg pl-2 pr-2 mt-[-5px]">20</span>
                                <BellAlertIcon className="w-6 h-6" />
                            </div>
                        </Link>
                        <Tooltip id="Header-Notifications" />
                    </li>
                    <li>
                        <Link href="/" className="block px-4 py-1 lg:py-4 hover:bg-blue-600" data-tooltip-content="Profile" data-tooltip-id="Header-Profile">
                            <UserCircleIcon className="w-6 h-6" />
                        </Link>
                        <Tooltip id="Header-Profile" />
                    </li>
                </ul>

            </div>
        </div>
    );
}
