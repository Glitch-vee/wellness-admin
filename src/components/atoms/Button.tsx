import React from "react";
import { Button as ChakraButton } from "@chakra-ui/react";

export const Button: React.FC<React.ComponentProps<typeof ChakraButton>> = (props) => {
  return <ChakraButton {...props} />;
};

export default Button;
