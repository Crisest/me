import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { ReactNode } from 'react';
import { IoEllipsisVertical } from 'react-icons/io5';
import styles from './YmMenu.module.css';

export interface YmMenuItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  disabled?: boolean;
}

interface YmMenuProps {
  items: YmMenuItem[];
  ariaLabel?: string;
  trigger?: ReactNode;
}

const YmMenu = ({ items, ariaLabel = 'Open menu', trigger }: YmMenuProps) => {
  return (
    <Menu>
      <MenuButton aria-label={ariaLabel} className={styles.trigger}>
        {trigger ?? <IoEllipsisVertical />}
      </MenuButton>
      <MenuItems
        transition
        anchor="bottom end"
        className={styles.items}
      >
        {items.map(item => (
          <MenuItem key={item.label}>
            <button
              type="button"
              className={styles.item}
              onClick={item.onClick}
              disabled={item.disabled}
            >
              {item.icon}
              {item.label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
};

export default YmMenu;
